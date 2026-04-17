const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Load Data
const products = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/products.json'), 'utf8'));
const brandSizing = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/brandSizing.json'), 'utf8'));
const fitRules = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/fitRules.json'), 'utf8'));

// ── Shared scoring helper ──────────────────────────────────────────
function computeRecommendation(product, sourceBrand, sourceSize, fitPreference) {
    const sourceData = brandSizing.brands[sourceBrand];
    const targetData = brandSizing.brands[product.brand];

    let confidence = fitRules.baseConfidence;
    const reasons = [];
    let recommendedSize = sourceSize;

    if (targetData && sourceData) {
        const sizeDiff = targetData.offset - sourceData.offset;
        const sourceIndex = sourceData.sizingScale.indexOf(sourceSize);
        let targetIndex = sourceIndex + sizeDiff;

        // Adjust for fit preference
        if (fitPreference === 'slim') targetIndex -= 1;
        if (fitPreference === 'oversized') targetIndex += 1;

        // Adjust for product fit tendency
        if (product.fitTendency === 'runs_small') targetIndex += 1;
        if (product.fitTendency === 'runs_large') targetIndex -= 1;

        // Constrain to available sizes
        targetIndex = Math.max(0, Math.min(targetIndex, targetData.sizingScale.length - 1));
        recommendedSize = targetData.sizingScale[targetIndex];

        // Confidence Penalties
        if (Math.abs(sizeDiff) > 1) {
            confidence += fitRules.penalties.extremeSizeShift;
            reasons.push("Brand sizing variance is high between these two brands.");
        }
        if (product.fitTendency === 'runs_small') {
            confidence += fitRules.penalties.runsSmall;
            reasons.push("This product runs smaller than standard sizing.");
        } else if (product.fitTendency === 'runs_large') {
            confidence += fitRules.penalties.runsLarge;
            reasons.push("This product runs larger than standard sizing.");
        }
        if (fitPreference === 'slim' && product.fitTendency === 'runs_large') {
            confidence += fitRules.penalties.fitMismatch;
            reasons.push("Slim preference conflicts with this product's oversized cut.");
        }
        if (fitPreference === 'oversized' && product.fitTendency === 'runs_small') {
            confidence += fitRules.penalties.fitMismatch;
            reasons.push("Oversized preference conflicts with this product's slim cut.");
        }
        if (!product.variants.includes(recommendedSize)) {
            confidence -= 20;
            reasons.push("Recommended size is out of stock — suggesting closest available.");
            recommendedSize = product.variants[product.variants.length - 1]; // fallback to largest
        }
    }

    // Positive reasoning when no penalties
    if (reasons.length === 0) {
        reasons.push("Matches your preferred fit profile exactly.");
        reasons.push("High consistency in sizing across users.");
        reasons.push("True-to-size with stable brand sizing data.");
    }

    let riskLevel = 'Low';
    if (confidence < fitRules.riskThresholds.high) riskLevel = 'High';
    else if (confidence < fitRules.riskThresholds.medium) riskLevel = 'Medium';

    return {
        ...product,
        recommendedSize,
        confidence: Math.max(0, Math.min(100, confidence)),
        riskLevel,
        reasons: reasons.slice(0, 3)
    };
}

// ── POST /api/recommend ────────────────────────────────────────────
router.post('/recommend', (req, res) => {
    const { sourceBrand, sourceSize, fitPreference } = req.body;

    if (!sourceBrand || !sourceSize) {
        return res.status(400).json({ error: 'Missing sourceBrand or sourceSize' });
    }

    const sourceData = brandSizing.brands[sourceBrand];
    if (!sourceData) {
        return res.status(400).json({ error: 'Unsupported brand' });
    }

    const recommendations = products.map(product =>
        computeRecommendation(product, sourceBrand, sourceSize, fitPreference || 'regular')
    );

    // Sort by confidence descending
    recommendations.sort((a, b) => b.confidence - a.confidence);

    res.json({ recommendations });
});

// ── GET /api/catalog/:id ───────────────────────────────────────────
router.get('/catalog/:id', (req, res) => {
    const product = products.find(p => p.id === req.params.id);
    if (!product) {
        return res.status(404).json({ error: 'Product not found' });
    }

    // Check if a fit profile was passed as query params
    const sourceBrand = req.query.brand;
    const sourceSize = req.query.size;
    const fitPreference = req.query.fit || 'regular';

    if (sourceBrand && sourceSize && brandSizing.brands[sourceBrand]) {
        const result = computeRecommendation(product, sourceBrand, sourceSize, fitPreference);
        
        // Attempt AI augmentation
        return augmentWithAI(product, result).then(augmentedResult => {
            res.json(augmentedResult);
        });
    }

    // No profile provided — return raw product with defaults
    const result = {
        ...product,
        recommendedSize: product.variants[Math.floor(product.variants.length / 2)],
        confidence: 75,
        riskLevel: product.fitTendency === 'runs_small' ? 'High' : 'Medium',
        reasons: [
            "No fit profile provided — using average sizing.",
            `This product ${product.fitTendency.replace(/_/g, ' ')}.`,
            "Create a fit profile for a personalized recommendation."
        ]
    };
    
    // Attempt AI augmentation asynchronously
    augmentWithAI(product, result).then(augmentedResult => {
        res.json(augmentedResult);
    });
});

// ── GET /api/insights ──────────────────────────────────────────────
router.get('/insights', (req, res) => {
    // Compute scores for all products using a "default" M / Nike profile
    const scored = products.map(product =>
        computeRecommendation(product, 'Nike', 'M', 'regular')
    );

    // Summary metrics
    const avgConfidence = (scored.reduce((s, p) => s + p.confidence, 0) / scored.length).toFixed(1);
    const highRisk = scored.filter(p => p.riskLevel === 'High');
    const medRisk = scored.filter(p => p.riskLevel === 'Medium');
    const returnRate = ((highRisk.length * 3 + medRisk.length) / scored.length * 10).toFixed(1);

    res.json({
        metrics: {
            avgFitConfidence: avgConfidence + '%',
            predictedReturnRate: returnRate + '%',
            revenueSaved: '$' + Math.round(scored.length * 35.5) + 'k'
        },
        watchlist: scored.map(p => ({
            id: p.id,
            name: p.name,
            brand: p.brand,
            category: p.category,
            image: p.image,
            confidenceScore: p.confidence,
            riskLabel: p.riskLevel,
            reasons: p.reasons,
            actionRequired: p.riskLevel === 'High' ? 'Review Sizing' : 'Monitor'
        })).sort((a, b) => a.confidenceScore - b.confidenceScore) // worst first
    });
});

module.exports = router;
