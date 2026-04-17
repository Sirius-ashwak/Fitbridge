# FitBridge AI - Intelligent Merchant & Shopper Sizing Assistant

**FitBridge AI** is an intelligent assistant designed to solve a critical issue in E-commerce apparel: inconsistent brand sizing that leads to low purchase confidence for shoppers and high return rates for retailers.

## 1. Chosen Vertical
**Retail & E-commerce Smart Assistant**

## 2. Approach and Logic
The E-commerce apparel industry suffers from massive return rates primarily driven by poor fit. Shoppers struggle to map their known sizes (e.g., "I am a Medium in Nike") to new brands (e.g., "What size am I in Lululemon?"). 

**The FitBridge AI Approach:**
FitBridge acts as an intelligent bridge between the shopper's physical fit profile and the specific technical constraints of a retailer's dynamic catalog.

**Logic Engine (`api/routes.js`):**
Our custom algorithm computes an **AI Confidence Score (0-100%)** and **Return Risk Level** dynamically by evaluating:
1. **Brand Normalization:** Utilizing a `brandSizing.json` mapping ruleset, it translates a "Size M" in a default brand into a normalized baseline.
2. **Product Tendency:** Evaluating item-specific metadata from `products.json` (e.g., if a specific jacket `runs_small`).
3. **Preference Penalties:** Applying a rule-based inference engine (`fitRules.json`) that penalizes confidence if a user requests an "Oversized" fit but the garment naturally runs "Slim", ensuring they are warned before making a high-risk purchase.

## 3. How the Solution Works
The project is built as a lightweight **Node.js (Express)** backend serving an interactive Vanilla JS frontend, demonstrating a full end-to-end loop:

1. **Shopper Onboarding (`http://localhost:3000/`)**: The user selects their known sizing in their favorite brand and specifies their fit preference. This profile is persisted locally.
2. **Dynamic Recommendations**: The shopper browses a catalog where the backend automatically overrides generic sizes with personalized recommended sizes.
3. **Intelligence Explanations (`product.html`)**: Clicking an item reveals the specific underlying AI reasoning (e.g., "This item runs small, your preferred fit requires sizing up.").
4. **Retailer Insights Console (`retail.html`)**: A dedicated dashboard for e-commerce catalog managers. The AI scans the live catalog against shopper averages, predicting the platform-wide Return Rate, revenue saved, and flagging specific "High Risk SKUs" that require size chart interventions.

### Running the Project Locally
Ensure you have Node.js installed.
```bash
# 1. Install dependencies
npm install

# 2. Start the intelligence server
node server.js

# 3. Open your browser
# Web App: http://localhost:3000
# Merchant Portal: http://localhost:3000/retail.html
```

## 4. Assumptions Made
*   **Static Data Mapping:** We assume that brand offsets are relatively linear (which they usually aren't). In a production environment, this `brandSizing.json` map would be replaced with dynamic volumetric scanning data or a database containing thousands of user reviews.
*   **Local Persistence:** User sessions are handled via standard browser `localStorage` to keep the architecture lightweight and under the 10MB Hackathon limit.
*   **Recommendation Scale:** The catalog is limited to 4 demonstration items to elegantly prove the AI rule penalty logic, prioritizing quality and speed of evaluation. 
