// One-off bulk assignment of HomeCard.targetTags for all existing cards
// (mostly the "Nora Daily" CSV import — see import-home-cards-from-csv.cjs —
// plus a couple of hand-authored cards). targetTags has no automatic
// derivation from card content (see HomeCardsPage.tsx's admin picker) — this
// script encodes a one-time editorial judgment call per card, made by
// reading each card's message/body and picking the closest-matching
// issue/parentGoal/ClinicalLevel tag(s) from the same fixed vocabularies the
// admin UI offers. Generic inspirational quotes with no clear topical tie
// (badge "Today's Thought") are deliberately left untagged — they stay in
// the general tier, which is correct for content meant to apply to everyone.
//
// Rationale per tag family:
//  - Specific issue/parentGoal tags are used wherever a card's content maps
//    fairly directly onto one of those onboarding-picker topics.
//  - The DE_ESCALATE clinical-level tag is added alongside big_feelings_
//    tantrums/listening_cooperation only for cards that are foundational
//    brain-science about meltdowns/behavior (i.e. genuinely relevant to
//    anyone at that clinical level, not just users who picked that specific
//    issue) — added sparingly, not on every tantrum-adjacent card.
//  - Nothing here is authoritative; re-tag anytime via the admin UI.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TAGS_BY_ID = {
  '3b64de79-ddd2-430b-a822-3639b131762d': ['social'], // Same-Gender Play Is a Normal Developmental Stage
  '8c5959a1-2785-4cbd-bc45-ab221de6d842': ['parenting_strategies'], // Babies Track Who's in Charge
  'dcda88e4-f1d7-4d4e-bc9a-2f199df7dee2': ['developmental_concerns'], // First Lies = Growing Brain
  '9b0b521b-b07f-41e0-84a2-e72e84b0d054': ['parenting_strategies', 'boost_kid_development'], // Praise Effort, Not Talent
  '936ee383-5427-4464-955a-7536eef01bc7': ['big_feelings_tantrums', 'DE_ESCALATE'], // Don't Reason During a Tantrum
  '39f9c12e-cfed-443c-a6b9-229830b5ac44': ['parenting_strategies'], // Do not lie to your kid
  '94091321-5cde-4472-a65b-80b44b593ac9': ['boost_kid_development'], // The Bilingual Advantage
  'bb2aa283-8d0c-4d5e-b700-c742759d7a18': ['confident_in_parenting'], // "Parenting is like a language..." (Becky Kennedy)
  'a30d38ad-d2a4-4d0e-814b-3cd7b4c7cfac': ['parenting_strategies'], // Finding "Sick Joy" in Mistakes
  '1dcc9ff1-2c69-4fcb-8677-26f7581dc865': [], // "Children do not experience our intentions..." — generic
  'd9d764be-cfbf-4ef5-af1d-e4f3eac4a7dc': ['truly_understanding_kid'], // "Children do not need us to shape them..."
  '87c60cec-ff5e-4d7c-9bd0-32562d716319': ['parenting_strategies'], // Discipline means to teach, not punish
  '4bc6b40c-707c-410c-b3bf-c0d8c574f227': ['parenting_strategies'], // Discipline is helping solve a problem
  '6f68dc62-0fbe-479c-8398-30cdf6c0c8aa': ['big_feelings_tantrums'], // Name it to tame it
  'fc2d2c3d-b12a-4a36-8eac-cd0de067a804': [], // "not just survive... help thrive" — generic
  'eff02d8d-0031-477e-ac98-ad267e8b4cbb': [], // "understand our own history..." — generic
  '20034674-73b6-4ea7-8893-2c55550bcee5': ['respond_calmly'], // Responsive parent = repair after disconnect
  '1e51cf47-ca43-47b8-aebc-817383231269': ['respond_calmly'], // Mindsight — choiceful not reactive
  '51c923ba-ffd5-45d4-8702-99ee67bcef28': ['big_feelings_tantrums'], // All feelings accepted, actions limited
  'bede4631-c721-4d6e-b67a-4bd80608637a': ['boost_kid_development'], // Play is the highest expression...
  '2a9a5015-50c4-4aef-8e07-4c2ae6444cda': ['truly_understanding_kid'], // "he is someone today"
  'b0d48798-efcd-4752-b670-23abc5770af8': [], // "build strong children..." — generic
  'b62cbd4d-eb2f-4254-b1bc-72cc60bc24ed': ['big_feelings_tantrums'], // Feelings acknowledged, not agreed with
  'f844f7d5-d7c4-4d1d-98d9-7cf1c1b4125c': ['parenting_strategies'], // Describe what you see/feel
  '5a2014f4-0b04-4227-96ae-f1dbfca9bab8': ['feeling_more_connected'], // "If children feel safe..."
  '397d97c5-3d37-459f-a269-3589e6e86e76': ['boost_kid_development'], // Let child be scriptwriter of own play
  '69ffc50b-655b-4ef4-afbd-b70e1e7887d9': ['parenting_strategies'], // Don't deprive them of wrestling with problems
  'b6890955-7a90-4c33-8933-54b7eb0b888c': ['feeling_more_connected'], // No learning without relationship
  '6a65f2e7-5c75-4429-b535-12362e71d9af': ['big_feelings_tantrums'], // "naughty child" doesn't exist
  '5f146917-5fbb-4c1e-909e-14d1b07d8044': ['big_feelings_tantrums'], // Asking comes in the form of behaviour
  '3a209c16-553e-47dc-a22f-b32e3a9500e9': ['boost_kid_development'], // Play is serious learning
  '0973e103-aea8-4378-bc36-1ddff627376c': ['feeling_less_overwhelmed'], // "she's doing a good job" (mother exhaustion)
  '49089c8b-2997-4287-a1ba-f4a2eb4e5136': ['feeling_more_connected'], // "everybody longs to be loved"
  'ca50f22a-12b0-4400-9432-5c3d349ce7dc': ['big_feelings_tantrums'], // Story behind misbehavior
  'd3a4eaf4-02be-4855-ae65-c45f84eb015e': ['big_feelings_tantrums'], // Children's emotions as real as yours
  '4f4446f8-9021-4f94-8e0c-0f220f351484': ['big_feelings_tantrums'], // Tearful boys comforted not shamed
  '25876387-ee3c-42a5-b17c-61b7a03f5a16': ['feeling_less_overwhelmed'], // "Mother is always exhausted"
  '8b82b08f-2e0f-4731-bd89-191537a70079': ['boost_kid_development'], // The Gentle Grammar Fix
  '11d93b1d-ae5c-4f70-bf47-0ea5846759c3': [], // Aristotle "give me a child until seven" — generic
  '421faa98-b8a2-43fe-a46f-468008131bf7': ['boost_kid_development'], // Montessori, birth to six
  '679d31ba-041f-47bf-9cba-af55f13c8f0b': ['respond_calmly'], // Adult shutdown rooted in childhood yelling
  '79f60dfd-d69a-4ea7-936d-78c427912373': ['parenting_strategies'], // The Childhood Triangle backpack
  'bcfb2273-20a9-4bb7-b20d-88caa1cf889d': [], // Up series — personality set by seven — generic
  '9ffbb8f8-53ec-4b19-839e-64903181ff69': ['feeling_more_connected'], // "She just wants her mother" (special time)
  '9b25e820-3df3-4db4-b208-cde97e960fa4': [], // "Best parenting advice?" — generic engagement prompt
  'b94572a0-e577-4139-81b1-3921aa4d5e5f': ['respond_calmly'], // Triggered = echo of unhealed wound
  'bfe5af64-486a-4459-9191-656559e31295': ['truly_understanding_kid'], // Child we wish we had vs. child in front of us
  '7631da60-2b52-4973-93aa-af77bda78a0c': ['feeling_more_connected'], // Human beings, not human doings
  '009adfe0-b0eb-4802-a8ae-7181b18257db': ['parenting_strategies'], // Creating the environment, not controlling outcome
  '5574c1b8-ec52-4efe-b2a8-e136057a27a0': ['big_feelings_tantrums', 'DE_ESCALATE'], // Brain Under Construction
  '64450a89-b6f8-42a4-aa65-16ba852b1246': ['social'], // Why Preschoolers Seem "Selfish" (egocentrism)
  '28bcb53b-9729-4e99-98d0-9c8d363e5a0f': ['listening_cooperation', 'DE_ESCALATE'], // Scolding reinforces bad behavior
  '4876b6ac-c95b-49a6-8f7a-6a4d62b9dae4': ['listening_cooperation', 'attention_focus'], // Why Preschoolers Forget Instructions
};

async function main() {
  let updated = 0;
  let skippedNoChange = 0;
  for (const [id, targetTags] of Object.entries(TAGS_BY_ID)) {
    const existing = await prisma.homeCard.findUnique({ where: { id }, select: { targetTags: true, message: true } });
    if (!existing) {
      console.warn(`SKIP (not found): ${id}`);
      continue;
    }
    if (JSON.stringify(existing.targetTags) === JSON.stringify(targetTags)) {
      skippedNoChange++;
      continue;
    }
    await prisma.homeCard.update({ where: { id }, data: { targetTags } });
    updated++;
    console.log(`  ${id} -> ${JSON.stringify(targetTags)}  (${existing.message.slice(0, 40)})`);
  }
  console.log(`\nUpdated ${updated} card(s), ${skippedNoChange} already matched, ${Object.keys(TAGS_BY_ID).length} total in mapping.`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
