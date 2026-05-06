const helpers = require('./src/utils/helpers');

const name1 = "Toàn bộ khoản nợ của Công ty TNHH Cườm Việt tại Agribank Chi nhánh Sài Gòn.";
const name2 = "Toàn bộ khoản nợ của Công ty TNHH Cườm Việt tại Agribank Chi nhánh Sài Gòn. ";
const name3 = "Toàn bộ khoản nợ của Công ty TNHH Cườm Việt tại Agribank Chi nhánh Sài Gòn.  ";

console.log("Core 1:", helpers.extractCoreIdentity(name1));
console.log("Props 1:", helpers.extractPropertyIdentifiers(name1));

console.log("Core 2:", helpers.extractCoreIdentity(name2));
console.log("Props 2:", helpers.extractPropertyIdentifiers(name2));

const idsA = helpers.extractPropertyIdentifiers(name1);
const idsB = helpers.extractPropertyIdentifiers(name2);

console.log("Conflict:", helpers.hasConflictingIdentifiers(idsA, idsB));
console.log("Match Strong:", helpers.hasMatchingStrongIdentifiers(idsA, idsB));

const { getBigrams, jaccardSimilarity } = helpers;
const bigramsA = getBigrams(helpers.extractCoreIdentity(name1));
const bigramsB = getBigrams(helpers.extractCoreIdentity(name2));
console.log("Jaccard:", jaccardSimilarity(bigramsA, bigramsB));
