# Staci recyclable colour threshold

## Change
- Treat a pallet as recyclable-dominant when one recyclable material is more than 90% of its completed breakdown.
- Classify that pallet as Green at 300kg or more, otherwise Blue.
- Keep the existing Red and Yellow rules for all other mixtures.
- Update the displayed colour descriptions to match the revised rule.

## Verification
- Check the boundary cases at 90%, above 90%, and 300kg.
- Confirm the same calculated colour is used in entry, review, dashboard, and saved reports.
