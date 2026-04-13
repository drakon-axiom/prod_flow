-- ProdFlow Seed Data
-- Admin login: admin@prodflow.local / admin123!

-- NOTE: The admin user must be created via auth schema INSERT or Supabase dashboard.
-- The seed data below was applied via execute_sql during initial setup.
-- Ingredient IDs, template IDs, and formula IDs are auto-generated.

-- See the Supabase MCP apply history for the exact INSERT statements used.
-- This file serves as documentation of what was seeded.

-- Admin user: admin@prodflow.local (role: admin)
-- 10 Ingredients: Water, Lavender Fragrance, SLS, CAPB, Glycerin, Citric Acid, NaCl, Preservative, Colorant, Aloe
-- 6 Field Templates: Temperature, pH, Viscosity, Color Check, Batch Notes, Clarity
-- 1 Formula: Lavender Body Wash (LBW-500ml) v1, base batch 10kg
--   - 10 ingredients with quantities
--   - 4 steps: Heat Water Phase, Add Glycerin & Aloe, Cool Down & Add Fragrance, Adjust pH & Thicken
--   - 8 step fields across steps (temperature readings, pH, viscosity, clarity, color check, notes)
-- 1 Queue Item: 25kg batch (2.5x scale), priority 5, due in 2 days
