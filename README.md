# 🌱 Organic Produce Authenticity Tracker

Welcome to a revolutionary Web3 solution for verifying the authenticity of organic produce! This project uses the Stacks blockchain and Clarity smart contracts to create a transparent, tamper-proof supply chain tracking system from farm to supermarket. It solves the real-world problem of organic fraud, where non-organic items are mislabeled as organic, eroding consumer trust and harming genuine farmers. By leveraging blockchain, we ensure immutable records of certification, handling, and transfers, allowing consumers to scan a QR code and verify the entire journey of their produce.

## ✨ Features

🌍 Register farms and certifiers with verified credentials  
📋 Create and track produce batches with unique IDs  
✅ Certify organic status at multiple checkpoints  
🚚 Log transportation and handling events securely  
🏪 Record supermarket receipts and sales  
🔍 Instant verification for consumers via QR codes or app  
⚖️ Dispute resolution for any chain breaks  
💰 Incentive tokens for compliant participants  
🔒 Prevent tampering with hash-based proofs  
📊 Analytics for supply chain efficiency

## 🛠 How It Works

This system is built with 8 modular Clarity smart contracts, each handling a specific aspect of the supply chain to ensure scalability and security. Contracts interact via traits and cross-calls for seamless data flow.

### Smart Contracts Overview

1. **FarmRegistry.clar**: Registers farms with owner details, location, and organic practices. Emits events for new registrations and updates.  
2. **CertifierRegistry.clar**: Onboards accredited organic certifiers, storing their credentials and allowing revocation if needed.  
3. **BatchCreation.clar**: Farmers create new produce batches with details like type (e.g., apples), harvest date, and initial hash. Links to FarmRegistry.  
4. **Certification.clar**: Certifiers inspect and certify batches, adding immutable stamps. Requires approval from CertifierRegistry.  
5. **TransportLog.clar**: Logs transfers between entities (farm to distributor, distributor to supermarket), recording timestamps, handlers, and conditions (e.g., temperature).  
6. **SupermarketReceipt.clar**: Supermarkets confirm receipt, update batch status, and generate consumer-facing QR codes linked to the chain.  
7. **Verification.clar**: Public read-only contract for querying the full history of a batch by ID, verifying hashes and signatures at each step.  
8. **IncentiveToken.clar**: Mints fungible tokens (e.g., OrgTokens) to reward compliant farmers and certifiers, redeemable for perks or used in disputes.

**For Farmers**  
- Register your farm via FarmRegistry.  
- Create a batch in BatchCreation with a SHA-256 hash of harvest data.  
- Get certified through Certification and log shipments in TransportLog.  
- Earn OrgTokens for verified organic compliance.

**For Certifiers**  
- Join via CertifierRegistry.  
- Approve batches in Certification, adding your digital signature.  
- Monitor chains and earn tokens for accurate verifications.

**For Transporters and Supermarkets**  
- Update status in TransportLog or SupermarketReceipt.  
- Ensure chain integrity to avoid penalties.

**For Consumers**  
- Scan a QR code linked to a batch ID.  
- Call Verification to see the full traceable history, confirming organic authenticity.

That's it! A fraud-resistant system that builds trust in organic produce while rewarding honest participants. Deploy on Stacks for low-cost, Bitcoin-secured transactions.