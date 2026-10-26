-- Maidan — reference (lookup) data, generated 2026-10-26T19:03:55Z
-- by scripts/build_reference_seed.js. Do not edit by hand.
--
-- Run AFTER supabase_deploy_all.sql, on a database that has the schema
-- but no rows. Safe to re-run: every statement is ON CONFLICT DO NOTHING.
--
-- This is configuration only — no bookings, expenses, investor figures
-- or user accounts. Create the first login with scripts/seed_admin.js.

BEGIN;

-- facilities (3 rows)
INSERT INTO facilities (id, code, name, location) VALUES (1, 'KMC', 'Maidan KMC', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO facilities (id, code, name, location) VALUES (2, 'EMAAR', 'Maidan Emaar', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO facilities (id, code, name, location) VALUES (3, 'MALIR', 'Maidan Malir Cantt', NULL) ON CONFLICT (id) DO NOTHING;
SELECT setval('facilities_id_seq', (SELECT MAX(id) FROM facilities));

-- sport_types (4 rows)
INSERT INTO sport_types (id, name) VALUES (1, 'Futsal') ON CONFLICT (id) DO NOTHING;
INSERT INTO sport_types (id, name) VALUES (2, 'Padel') ON CONFLICT (id) DO NOTHING;
INSERT INTO sport_types (id, name) VALUES (5, 'Pickleball') ON CONFLICT (id) DO NOTHING;
INSERT INTO sport_types (id, name) VALUES (6, 'Multi Purpose') ON CONFLICT (id) DO NOTHING;
SELECT setval('sport_types_id_seq', (SELECT MAX(id) FROM sport_types));

-- payment_methods (7 rows)
INSERT INTO payment_methods (id, name) VALUES (1, 'Cash') ON CONFLICT (id) DO NOTHING;
INSERT INTO payment_methods (id, name) VALUES (2, 'Card') ON CONFLICT (id) DO NOTHING;
INSERT INTO payment_methods (id, name) VALUES (3, 'IBFT') ON CONFLICT (id) DO NOTHING;
INSERT INTO payment_methods (id, name) VALUES (4, 'Cheque') ON CONFLICT (id) DO NOTHING;
INSERT INTO payment_methods (id, name) VALUES (5, 'NA') ON CONFLICT (id) DO NOTHING;
INSERT INTO payment_methods (id, name) VALUES (9, 'GT IBFT') ON CONFLICT (id) DO NOTHING;
INSERT INTO payment_methods (id, name) VALUES (10, 'GT Cash') ON CONFLICT (id) DO NOTHING;
SELECT setval('payment_methods_id_seq', (SELECT MAX(id) FROM payment_methods));

-- expense_categories (60 rows)
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (2, 'Grounds & Facility Maintenance', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (7, 'Events & Tournaments', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (9, 'Food and Staff welfare', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (11, 'Marketing & Sales', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (13, 'Fuel and Transport', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (15, 'Payroll & Human Resources', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (17, 'Technology & Software', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (19, 'Rent, Lease & Financing', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (21, 'Administrative Expenses', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (26, 'Miscellaneous Expenses', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (34, 'Sports Equipment & Supplies', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (36, 'Security & Safety', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (41, 'Facility Operations', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (3, 'Sanitary', 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (4, 'Maintenance of Courts', 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (5, 'Hardware', 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (6, 'Electric Supply', 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (39, 'Gardening and Fumigation', 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (53, 'CCTV Maintenance', 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (54, 'Court Expense', 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (55, 'Generator', 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (60, 'Paint', 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (8, 'External Event', 7) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (23, 'Internal Event', 7) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (10, 'Food Expense', 9) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (12, 'Marketing & Branding', 11) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (14, 'Fuel', 13) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (48, 'Transport Rent', 13) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (16, 'Staff Salaries', 15) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (24, 'Working Share', 15) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (25, 'Back Office Salaries', 15) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (29, 'advance salary', 15) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (33, 'Investor Share', 15) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (61, 'bonus', 15) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (89, 'working share', 15) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (18, 'Wifi', 17) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (30, 'Telenor', 17) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (57, 'Application making', 17) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (62, 'Matchpoint Application', 17) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (72, 'Application Making', 17) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (20, 'Rent', 19) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (31, 'SRB', 19) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (56, 'Ehhed', 19) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (22, 'Refreshment', 21) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (32, 'Labour', 21) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (44, 'Office Expense', 21) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (47, 'guard tea', 21) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (51, 'Stationery', 21) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (27, 'Sadqa and Advance', 26) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (28, 'Advance Return', 26) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (38, 'External Construction and Liabilities', 26) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (50, 'staff equipment', 26) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (35, 'Padel Equipments (Rackets, Grips, Balls, Net etc..)', 34) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (40, 'Pickleball Equipments', 34) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (52, 'Multi Purpose Equipments', 34) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (58, 'Futsal Equipments (Wickets, Futsal, Balls etc..)', 34) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (37, 'Security', 36) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (46, 'First Aid', 36) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (42, 'Electricity / Water Bill', 41) ON CONFLICT (id) DO NOTHING;
INSERT INTO expense_categories (id, name, parent_category_id) VALUES (45, 'wastage charges', 41) ON CONFLICT (id) DO NOTHING;
SELECT setval('expense_categories_id_seq', (SELECT MAX(id) FROM expense_categories));

-- bank_bin_reference (68 rows)
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('401769', 'Meezan Bank Limited', 'Visa Infinite Debit Card', '0.5000', '5000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('402793', 'Bank Al Falah', 'Islamic Premier Signature Debit Card', '0.4000', '5000.00', 30, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('405048', 'Habib Bank Limited', 'VISA World Elite Debit Card', '0.2500', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('406893', 'Habib Bank Limited', 'VISA Gold Credit Card', '0.1500', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('407937', 'Meezan Bank Limited', 'Visa Women Debit Card', '0.1500', '2000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('408413', 'United Bank Limited', 'Visa Infinite Debit Card', '0.5000', '15000.00', 30, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('416653', 'Meezan Bank Limited', 'Visa Platinum Aura Card', '0.3000', '3000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('420251', 'Bank Al Falah', 'Premium Signature Debit Card', '0.4000', '5000.00', 30, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('422070', 'Bank Al Falah', 'Premium Platinum Credit Card', '0.4000', '5000.00', 30, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('428273', 'Dubai Islamic Bank', 'Ayan Debit Card-(% or cap appli. whichever is lower)', '0.3000', '3000.00', 10, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('434993', 'Dubai Islamic Bank', 'Signature Visa Debit', '0.4000', '3000.00', 10, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('437452', 'Habib Metropolitan Bank Limited', 'Visa Classic', '0.2500', '2500.00', 30, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('437453', 'Habib Metropolitan Bank Limited', 'Visa Gold', '0.2500', '3000.00', 30, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('437455', 'Habib Metropolitan Bank Limited', 'Visa Platinum', '0.3000', '3500.00', 30, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('437525', 'Meezan Bank Limited', 'Visa Platinum Debit Card', '0.3000', '3000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('452469', 'United Bank Limited', 'Platinum Visa Debit', '0.3000', '4000.00', 30, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('458163', 'United Bank Limited', 'Signature Visa', '0.3000', '4000.00', 30, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('458827', 'United Bank Limited', 'Platinum Visa Credit', '0.3000', '4000.00', 30, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('461241', 'Habib Bank Limited', 'VISA Green Credit Card', '0.1000', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('464951', 'Meezan Bank Limited', 'Visa Silver Debit Card', '0.1500', '2000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('464952', 'Meezan Bank Limited', 'Visa Gold Debit Card', '0.2000', '2500.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('472439', 'United Bank Limited', 'Platinum Visa Credit', '0.3000', '4000.00', 30, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('478404', 'Habib Bank Limited', 'VISA Green Credit Card', '0.1000', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('478428', 'Habib Bank Limited', 'VISA Platinum Credit Card', '0.2500', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('482096', 'Habib Bank Limited', 'VISA Chip Debit Card', '0.1000', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('482100', 'Habib Bank Limited', 'VISA USD Debit Card', '0.1000', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('484025', 'Habib Metropolitan Bank Limited', 'Visa Infinite', '0.4000', '10000.00', 30, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('489245', 'Habib Metropolitan Bank Limited', 'Visa Ladies', '0.2500', '3000.00', 30, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('490245', 'Dubai Islamic Bank', 'Infinite Visa Debit', '0.5000', '6000.00', 10, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('490286', 'Habib Bank Limited', 'VISA Green Credit Card', '0.1000', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('490287', 'Habib Bank Limited', 'VISA Green Credit Card', '0.1000', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('490288', 'Habib Bank Limited', 'VISA Platinum Credit Card', '0.2500', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('490471', 'Habib Bank Limited', 'VISA Chip Debit Card', '0.1000', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('494122', 'Habib Bank Limited', 'VISA Green Credit Card', '0.1000', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('494123', 'Habib Bank Limited', 'VISA Gold Credit Card', '0.1500', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('516062', 'Meezan Bank Limited', 'MasterCard Classic Debit Card', '0.2000', '2000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('517420', 'Habib Bank Limited', 'MasterCard World Debit Card', '0.2500', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('518496', 'Habib Bank Limited', 'MasterCard Fuel Saver Gold Credit Card', '0.1500', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('520165', 'Bank Islami', 'Titanium & Priority Debit Master Card', '0.4000', '2000.00', 30, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('524521', 'Meezan Bank Limited', 'MasterCard Titanium Debit Card', '0.2000', '2500.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('524643', 'Habib Bank Limited', 'MasterCard Fuel Saver Green Credit Card', '0.1000', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('526185', 'Habib Bank Limited', 'VISA Debit Card', '0.1000', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('526220', 'Habib Bank Limited', 'MasterCard Gold Credit Card', '0.1500', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('526919', 'Albarak Bank Limited', 'Platinum Card', '0.4000', '5000.00', 8, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('531035', 'Habib Bank Limited', 'MasterCard HBL Gold Debit Card', '0.1500', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('531096', 'Habib Bank Limited', 'MasterCard Titanium Debit Card', '0.1500', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('532709', 'United Bank Limited', 'Master Signature Debit Card', '0.5000', '15000.00', 12, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('533254', 'Jazz Cash', 'Tap Pay – JC App & Google wallet', '0.3000', '2500.00', 30, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('533288', 'Habib Bank Limited', 'MasterCard World Elite Debit Card', '0.2500', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('535368', 'Habib Bank Limited', 'MasterCard World Debit Card', '0.2500', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('536619', 'Habib Bank Limited', 'MasterCard Debit Card', '0.1000', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('536632', 'Habib Bank Limited', 'MasterCard Titanium Debit Card', '0.1500', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('538086', 'Meezan Bank Limited', 'MasterCard Platinum Debit Card', '0.3000', '3000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('539160', 'Habib Bank Limited', 'MasterCard HBL Gold Debit Card', '0.1500', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('542831', 'Habib Bank Limited', 'MasterCard Gold Credit Card', '0.1500', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('543126', 'Bank Islami', 'Classic Debit Master Card', '0.2500', '2000.00', 30, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('545990', 'Habib Bank Limited', 'MasterCard Green Credit Card', '0.1000', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('547175', 'Habib Bank Limited', 'MasterCard Green Credit Card', '0.1000', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('547753', 'Meezan Bank Limited', 'MasterCard World Debit Card', '0.4000', '4000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('549690', 'Habib Bank Limited', 'MasterCard Fuel Saver Gold Credit Card', '0.1500', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('555411', 'United Bank Limited', 'Platinum Mastercard', '0.3000', '4000.00', 30, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('555699', 'Habib Bank Limited', 'MasterCard World Elite Debit Card', '0.2500', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('559177', 'Jazz Cash', 'Standard & Women Card', '0.3000', '2500.00', 30, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('621657', 'Habib Bank Limited', 'Union Pay Debit Card', '0.1000', '10000.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('42004500', 'Meezan Bank Limited', 'Visa Student Debit Card', '0.2000', '2500.00', NULL, NULL, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('42131000', 'Bank Al Falah', 'Visa Infinite Credit Card', '0.5000', '15000.00', 30, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('42933500', 'Bank Al Falah', 'Visa Infinite Debit Card', '0.5000', '15000.00', 30, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;
INSERT INTO bank_bin_reference (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit, bank_discount_share) VALUES ('45816400', 'Bank Al Falah', 'Visa Infinite Islamic Debit Card', '0.5000', '15000.00', 30, 1, NULL) ON CONFLICT (bin_number) DO NOTHING;

COMMIT;
