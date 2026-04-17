const fs = require('fs');
const path = require('path');

const brandSizing = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/brandSizing.json'), 'utf8'));
const fitRules = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/fitRules.json'), 'utf8'));

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

module.exports = { computeRecommendation };
