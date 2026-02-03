-- 1. Ensure the uuid-ossp extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Add the new column for Action Tips if it doesn't exist yet
ALTER TABLE milestone_library 
ADD COLUMN IF NOT EXISTS action_tip TEXT;

-- 3. Insert the data with the new Action Tips
INSERT INTO milestone_library (
    id, 
    key, 
    category, 
    grouping_stage, 
    display_title, 
    detection_mode, 
    threshold_value, 
    median_age_months, 
    mastery_90_age_months, 
    source_reference,
    action_tip
) VALUES
-- LANGUAGE DOMAIN (Brown's Stages)
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'language_brown_stage1_semantic', 'Language', 'Stage I (12-26m)', 'Semantic Roles (Agent+Action)', 'AUDIO_DIRECT', 3, 12, 26, 'Brown (1973) Stage I', 
 'Use "Expansions". If your child says "Doggy," you say "Big doggy!" or "Doggy bark!" to add context.'),

('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'language_brown_stage1_negation', 'Language', 'Stage I (12-26m)', 'Early Negation (''No'' + X)', 'AUDIO_DIRECT', 3, 12, 26, 'Brown (1973) Stage I', 
 'Model the full thought instead of correcting. If they say "No juice," reply: "Oh, you have no more juice."'),

('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'language_brown_stage2_ing', 'Language', 'Stage II (27-30m)', 'Present Progressive (-ing)', 'AUDIO_DIRECT', 3, 27, 30, 'Brown (1973) Stage II', 
 'Sportscast their play. Narrate what is happening right now: "The car is going up! It is spinning!"'),

('d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'language_brown_stage2_plurals', 'Language', 'Stage II (27-30m)', 'Regular Plurals (-s)', 'AUDIO_DIRECT', 3, 27, 30, 'Brown (1973) Stage II', 
 'Emphasize the "S" sound at the end of words during snack time: "Do you want crackerS or grapeS?"'),

('e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'language_brown_stage2_prepositions', 'Language', 'Stage II (27-30m)', 'Prepositions (In/On)', 'AUDIO_DIRECT', 3, 27, 30, 'Brown (1973) Stage II', 
 'Play hide and seek with a toy. Ask: "Is the bear IN the box? No, he is ON the chair!"'),

('f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'language_brown_stage3_past_irregular', 'Language', 'Stage III (31-34m)', 'Irregular Past Tense (Fell/Ran)', 'AUDIO_DIRECT', 2, 31, 34, 'Brown (1973) Stage III', 
 'Use "Recasting". If they say "I falled," simply reply "Yes, you fell down" without saying they were wrong.'),

('06eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'language_brown_stage3_possessive', 'Language', 'Stage III (31-34m)', 'Possessives (''s)', 'AUDIO_DIRECT', 2, 31, 34, 'Brown (1973) Stage III', 
 'Point out ownership during cleanup. "This is Mommy''s shoe. That is Baby''s ball."'),

('17eebc99-9c0b-4ef8-bb6d-6bb9bd380a18', 'language_brown_stage4_articles', 'Language', 'Stage IV (35-40m)', 'Articles (A/The)', 'AUDIO_DIRECT', 3, 35, 40, 'Brown (1973) Stage IV', 
 'Use "Time Travel" talk. Discuss yesterday''s specific events: "We went to THE park and saw A dog."'),

('28eebc99-9c0b-4ef8-bb6d-6bb9bd380a19', 'language_brown_stage4_past_regular', 'Language', 'Stage IV (35-40m)', 'Regular Past Tense (-ed)', 'AUDIO_DIRECT', 3, 35, 40, 'Brown (1973) Stage IV', 
 'Narrate completed actions at the end of the day. "We walk-ed to the car. We wash-ed our hands."'),

('39eebc99-9c0b-4ef8-bb6d-6bb9bd380a20', 'language_brown_stage5_3rd_person', 'Language', 'Stage V (41-46m)', '3rd Person Irregular (Does/Has)', 'AUDIO_DIRECT', 2, 41, 46, 'Brown (1973) Stage V', 
 'Highlight habits and routines. "Daddy likes coffee. The sun shines bright."'),

('40eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'language_post_stage5_passive', 'Language', 'Post-Stage V (47m+)', 'Passive Voice Construction', 'AUDIO_DIRECT', 1, 47, 84, 'Brown (1973) Post-V', 
 'Read books and flip the subject. "Look! The ball was thrown by the boy."'),

-- COGNITIVE DOMAIN (Piaget/Brown Proxies)
('51eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'cognitive_preop_naming', 'Cognitive', 'Pre-Operational (24-36m)', 'Immediate Naming (Here & Now)', 'AUDIO_DIRECT', 3, 24, 36, 'Brown/Piaget Correlation', 
 'Play "I Spy". Ask "What is that?" regarding immediate objects in the room to build naming speed.'),

('62eebc99-9c0b-4ef8-bb6d-6bb9bd380a23', 'cognitive_temporal_sequencing', 'Cognitive', 'Temporal Logic (36-48m)', 'Sequencing (First/Then)', 'AUDIO_DIRECT', 1, 36, 48, 'Brown Stage IV Proxy', 
 'Use "First/Then" language for routines. "First we put on socks, then we put on shoes."'),

('73eebc99-9c0b-4ef8-bb6d-6bb9bd380a24', 'cognitive_temporal_decentering', 'Cognitive', 'Temporal Logic (36-48m)', 'Decentering (Talking about Past)', 'AUDIO_DIRECT', 2, 36, 48, 'Brown Stage IV Proxy', 
 'Ask recall questions at dinner. "What was the very first thing we did at the park today?"'),

('84eebc99-9c0b-4ef8-bb6d-6bb9bd380a25', 'cognitive_causal_reasoning', 'Cognitive', 'Causal Logic (48-84m)', 'Causal Linking (Because/So)', 'AUDIO_DIRECT', 2, 48, 84, 'Brown Stage V Proxy', 
 'Play "Consequence Prediction". While reading, ask: "What will happen next BECAUSE it is raining?"'),

('95eebc99-9c0b-4ef8-bb6d-6bb9bd380a26', 'cognitive_tom_questions', 'Cognitive', 'Causal Logic (48-84m)', 'Theory of Mind Questions', 'AUDIO_DIRECT', 1, 48, 84, 'Brown Stage V Proxy', 
 'Read stories and ask about characters'' thoughts. "Why do you think he feels sad right now?"'),

-- SOCIAL DOMAIN (Halliday Interactional)
('a6eebc99-9c0b-4ef8-bb6d-6bb9bd380a27', 'social_interaction_initiation', 'Social', 'Transition (24-36m)', 'Initiation (''Let''s'')', 'AUDIO_DIRECT', 2, 24, 36, 'Halliday Interactional', 
 'Use "Let''s" statements to model joint play. "Let''s build a tower together!"'),

('b7eebc99-9c0b-4ef8-bb6d-6bb9bd380a28', 'social_interaction_turntaking', 'Social', 'Transition (24-36m)', 'Verbal Turn Taking (''My turn'')', 'AUDIO_DIRECT', 2, 24, 36, 'Halliday Interactional', 
 'Use a physical object (like a ball) to pass back and forth saying "My turn... Your turn."'),

('c8eebc99-9c0b-4ef8-bb6d-6bb9bd380a29', 'social_pragmatic_politeness', 'Social', 'Pragmatic Dev (36-60m)', 'Politeness Markers (Please/Thanks)', 'AUDIO_DIRECT', 2, 36, 60, 'Halliday Interactional', 
 'Role play with dolls. Have the doll say "Please" and "Thank you" to get a pretend snack.'),

('d9eebc99-9c0b-4ef8-bb6d-6bb9bd380a30', 'social_pragmatic_friendship', 'Social', 'Pragmatic Dev (36-60m)', 'Explicit Friendship Definition', 'AUDIO_DIRECT', 1, 36, 60, 'Halliday Interactional', 
 'Explicitly label friendly acts. "You shared your toy! That is what a friend does."'),

('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', 'social_interpersonal_negotiation', 'Social', 'Interpersonal (60-84m)', 'Complex Play Negotiation', 'AUDIO_DIRECT', 1, 60, 84, 'Halliday Interactional', 
 'Pose "Win-Win" challenges. "You want blocks, he wants cars. How can we play with both?"'),

-- EMOTIONAL DOMAIN (Halliday Personal)
('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a32', 'emotional_personal_boundaries', 'Emotional', 'Assertion (24-36m)', 'Boundaries (''Mine''/''No'')', 'AUDIO_DIRECT', 3, 24, 36, 'Halliday Personal', 
 'Offer limited choices. "You don''t want the coat? Do you want the blue one or the red one?"'),

('02eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'emotional_personal_self_concept', 'Emotional', 'Identity (36-60m)', 'Self-Concept (''I am...'')', 'AUDIO_DIRECT', 2, 36, 60, 'Halliday Personal', 
 'Use an affirmation mirror. Look in the mirror together and say "I am a fast runner!"'),

('13eebc99-9c0b-4ef8-bb6d-6bb9bd380a34', 'emotional_regulation_justification', 'Emotional', 'Regulation (60-84m)', 'Emotional Justification (Feel...Because)', 'AUDIO_DIRECT', 1, 60, 84, 'Halliday Personal', 
 'Use "Name it to Tame it". "You feel sad BECAUSE the tower fell, right?"'),

-- CONNECTION DOMAIN (Biringen EA)
('24eebc99-9c0b-4ef8-bb6d-6bb9bd380a35', 'connection_ea_physical_pull', 'Connection', 'Involvement (24-48m)', 'Physical ''Check-in'' (Pulling/Showing)', 'NARRATION_PROXY', 2, 24, 48, 'Biringen EA', 
 'The 30-Second Spotlight. When they physically pull you, stop everything and give full eye contact for 30s.'),

('35eebc99-9c0b-4ef8-bb6d-6bb9bd380a36', 'connection_ea_verbal_invite', 'Connection', 'Partnership (48-84m)', 'Verbal Role Invitation', 'AUDIO_DIRECT', 1, 48, 84, 'Biringen EA', 
 'Accept the Invitation. If they assign you a role in play, accept it immediately and follow their script.');