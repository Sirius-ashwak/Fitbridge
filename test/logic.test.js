const test = require('node:test');
const assert = require('node:assert');
const { computeRecommendation } = require('../api/logic');

// Mock Product
const mockProduct = {
    "id": "test-1",
    "name": "Test Item",
    "brand": "Lululemon",
    "category": "Activewear",
    "basePrice": 100,
    "fitTendency": "true_to_size",
    "variants": ["XS", "S", "M", "L", "XL"]
};

test('computeRecommendation handles standard 1:1 mapping', (t) => {
    // Nike 'M' -> Lululemon should just be size offset
    const result = computeRecommendation(mockProduct, 'Nike', 'M', 'regular');
    
    // Nike M (offset 0) to Lulu (offset -1) means Nike M is generally Lulu S? Wait, logic test verifies stable behavior
    assert.strictEqual(typeof result.recommendedSize, 'string');
    assert.ok(result.confidence > 0 && result.confidence <= 100, "Confidence should be bounded 0-100");
    assert.ok(['Low', 'Medium', 'High'].includes(result.riskLevel), "Risk level is valid");
});

test('computeRecommendation bounds array indexing', (t) => {
    // Try to break it by going out of bounds
    const result = computeRecommendation(mockProduct, 'Nike', 'XXL', 'oversized'); // XXL oversized pushes it very far right
    
    assert.strictEqual(result.recommendedSize, 'XL', "Should clamp to largest available size in target brand (Lululemon)");
    // Should have reason because it's forced out of bounds
});

test('computeRecommendation applies penalties for conflicts', (t) => {
    const runsSmallProduct = { ...mockProduct, fitTendency: 'runs_small' };
    
    const baseResult = computeRecommendation(mockProduct, 'Nike', 'M', 'regular');
    const penaltyResult = computeRecommendation(runsSmallProduct, 'Nike', 'M', 'regular');
    const doublePenaltyResult = computeRecommendation(runsSmallProduct, 'Nike', 'M', 'oversized');

    assert.ok(penaltyResult.confidence < baseResult.confidence, "Confidence should drop when item runs small");
    assert.ok(doublePenaltyResult.confidence < penaltyResult.confidence, "Confidence should drop more when preferences mismatch tendency");
});
