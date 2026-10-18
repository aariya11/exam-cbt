/**
 * RankForge seed.
 *
 * Development data only. Every seeded student is marked isDemo=true and every
 * question is labelled with its provenance ("RankForge original practice
 * item"). Nothing in this file claims official examination affiliation.
 *
 * Run: npm run db:seed
 * WARNING: this script deletes existing dev data before seeding.
 */
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth-core";
import { createRng } from "../src/lib/rng";
import { ACHIEVEMENTS } from "../src/lib/constants";
import { finalizeAttempt } from "../src/lib/attempt-service";

type Q = [string, [string, string, string, string], number, string];

const BANK: Record<string, { easy: Q[]; medium: Q[]; hard: Q[] }> = {
  "Quantitative Aptitude": {
    easy: [
      ["What is 12 × 7?", ["84", "72", "94", "64"], 0, "12 × 7 = 84."],
      ["What is 25% of 200?", ["50", "25", "75", "100"], 0, "25% of 200 = 200 × 0.25 = 50."],
      ["What is the HCF of 12 and 18?", ["6", "3", "9", "12"], 0, "12 = 2²·3, 18 = 2·3², so HCF = 2·3 = 6."],
      ["What is the LCM of 6 and 8?", ["24", "48", "12", "16"], 0, "LCM(6, 8) = 2³·3 = 24."],
      ["What is the average of 5, 10 and 15?", ["10", "12", "8", "15"], 0, "(5 + 10 + 15) ÷ 3 = 10."],
      ["Express 3/4 as a percentage.", ["75%", "60%", "70%", "80%"], 0, "3/4 = 0.75 = 75%."],
      ["Simple interest on ₹1,000 at 5% per year for 2 years is:", ["₹100", "₹50", "₹150", "₹105"], 0, "SI = P·R·T/100 = 1000 × 5 × 2 ÷ 100 = ₹100."],
      ["A car travels at 60 km/h for 2 hours. How far does it travel?", ["120 km", "60 km", "90 km", "150 km"], 0, "Distance = speed × time = 60 × 2 = 120 km."],
      ["What is 0.5 × 0.2?", ["0.10", "0.7", "0.01", "1.0"], 0, "0.5 × 0.2 = 0.10."],
    ],
    medium: [
      ["What is 15% of 480?", ["72", "68", "76", "66"], 0, "480 × 0.15 = 72."],
      ["Two numbers are in the ratio 3 : 4 and their sum is 84. What is the larger number?", ["48", "42", "36", "56"], 0, "3x + 4x = 84 gives x = 12, so the larger number is 48."],
      ["Compound interest on ₹1,000 at 10% per year for 2 years is:", ["₹210", "₹200", "₹121", "₹220"], 0, "CI = 1000(1.1² − 1) = ₹210."],
      ["A 120 m long train runs at 20 m/s. How long does it take to pass a pole?", ["6 s", "4 s", "8 s", "12 s"], 0, "Time = length ÷ speed = 120 ÷ 20 = 6 s."],
      ["What is the average of the first 10 natural numbers?", ["5.5", "5", "6", "10"], 0, "Average = (1 + 10) ÷ 2 = 5.5."],
      ["If 4 workers finish a job in 12 days, how long will 6 workers take at the same rate?", ["8 days", "9 days", "6 days", "18 days"], 0, "Work = 4 × 12 = 48 worker-days; 48 ÷ 6 = 8 days."],
      ["An article bought for ₹400 is sold for ₹500. What is the profit percentage?", ["25%", "20%", "15%", "10%"], 0, "Profit % = 100 ÷ 400 × 100 = 25%."],
      ["Solve for x: 2x + 5 = 17.", ["6", "5", "7", "11"], 0, "2x = 12, so x = 6."],
      ["A shirt marked ₹250 is sold at a 20% discount. What is the selling price?", ["₹200", "₹220", "₹230", "₹180"], 0, "250 × 0.8 = ₹200."],
    ],
    hard: [
      ["The difference between compound and simple interest on ₹1,000 at 10% per year for 2 years is:", ["₹10", "₹20", "₹5", "₹1"], 0, "CI − SI = P(R/100)² = 1000 × 0.01 = ₹10."],
      ["If speed increases by 50% for the same distance, travel time is reduced by:", ["33⅓%", "50%", "25%", "30%"], 0, "Time is inversely proportional to speed: 1 − 1/1.5 = 33⅓%."],
      ["Two pipes fill a tank in 12 h and 18 h. Working together they take:", ["7.2 h", "15 h", "9 h", "6 h"], 0, "1/12 + 1/18 = 5/36, so 36/5 = 7.2 h."],
      ["What is the sum of squares of the first 10 natural numbers?", ["385", "330", "505", "285"], 0, "n(n+1)(2n+1)/6 = 10·11·21/6 = 385."],
      ["40 L of a mixture has milk and water in the ratio 3 : 1. After adding 8 L of water, the new ratio is:", ["5 : 3", "3 : 2", "4 : 3", "5 : 2"], 0, "Milk = 30 L, water = 10 + 8 = 18 L, so 30 : 18 = 5 : 3."],
      ["A can do a job in 10 days and B in 15 days. Together they finish it in:", ["6 days", "5 days", "7.5 days", "12 days"], 0, "1/10 + 1/15 = 1/6, so 6 days."],
      ["A fair die is rolled once. What is the probability of an even number?", ["1/2", "1/3", "1/6", "2/3"], 0, "Even outcomes 2, 4, 6 out of 6, so 1/2."],
      ["The average of 7 numbers is 20. When one number is removed the average of the rest is 18. The removed number is:", ["32", "30", "28", "34"], 0, "140 − 6 × 18 = 140 − 108 = 32."],
      ["What is (1.05)²?", ["1.1025", "1.1", "1.0525", "1.005"], 0, "(1.05)² = 1.1025."],
    ],
  },
  Reasoning: {
    easy: [
      ["Find the next number: 2, 4, 6, 8, __", ["10", "9", "12", "14"], 0, "The sequence increases by 2 each time."],
      ["Which is the odd one out: apple, banana, carrot, mango?", ["carrot", "apple", "banana", "mango"], 0, "Carrot is a vegetable; the others are fruits."],
      ["If A is north of B, then B is ____ of A.", ["south", "north", "east", "west"], 0, "Opposite of north is south."],
      ["If CAT is coded as DBU, then DOG is coded as:", ["EPH", "EOH", "DPH", "FPH"], 0, "Each letter shifts one forward: D→E, O→P, G→H."],
      ["Find the next term: A, C, E, G, __", ["I", "H", "J", "K"], 0, "Skipping one letter each time gives I."],
      ["Find the next number: 5, 10, 20, 40, __", ["80", "60", "70", "100"], 0, "Each term doubles."],
      ["Pointing to a man, Ravi said, 'He is my father's only son.' Who is the man?", ["Ravi himself", "Ravi's uncle", "Ravi's cousin", "Ravi's brother"], 0, "The only son of Ravi's father is Ravi."],
      ["Find the next number: 1, 4, 9, 16, __", ["25", "20", "24", "36"], 0, "Perfect squares: 5² = 25."],
      ["Find the next letter: Z, X, V, T, __", ["R", "S", "Q", "P"], 0, "Letters decrease by 2 each time."],
    ],
    medium: [
      ["Find the next number: 3, 6, 11, 18, __", ["27", "25", "26", "29"], 0, "Differences are +3, +5, +7, +9."],
      ["Find the next number: 1, 1, 2, 3, 5, 8, __", ["13", "11", "12", "10"], 0, "Each term is the sum of the previous two (Fibonacci)."],
      ["If EARTH is coded as FBSUI, then MOON is coded as:", ["NPPO", "NPPN", "LNNM", "OPPQ"], 0, "Each letter shifts one forward."],
      ["All roses are flowers. Some flowers fade quickly. Which conclusion follows?", ["None of these conclusions follow", "Some roses fade quickly", "All flowers are roses", "No rose fades quickly"], 0, "The premises do not connect roses to fading, so nothing follows."],
      ["In a class, Meera is 7th from the top and 26th from the bottom. How many students are there?", ["32", "33", "31", "34"], 0, "7 + 26 − 1 = 32."],
      ["Your sister's father's brother is your:", ["uncle", "cousin", "nephew", "grandfather"], 0, "Your sister's father is your father; his brother is your uncle."],
      ["What is the angle between the hands of a clock at exactly 3 o'clock?", ["90°", "60°", "120°", "45°"], 0, "Each hour mark is 30°, so 3 hours = 90°."],
      ["Find the next number: 2, 6, 12, 20, 30, __", ["42", "40", "44", "36"], 0, "n(n+1) for n = 6 gives 42."],
      ["A man walks 5 km north, turns right and walks 3 km, then turns right and walks 5 km. Where is he relative to the start?", ["3 km east", "3 km west", "5 km east", "3 km north"], 0, "He ends at (3, 0): 3 km east of the start."],
    ],
    hard: [
      ["Find the next number: 1, 4, 27, 256, __", ["3125", "1024", "625", "2048"], 0, "Each term is nⁿ: 5⁵ = 3125."],
      ["If TEACHER is coded as REHCAET, then STUDENT is coded as:", ["TNEDUTS", "TNEDUST", "TNEUDTS", "TUEDNTS"], 0, "The word is simply reversed."],
      ["All engineers are graduates. All graduates are employees. Which conclusion follows?", ["All engineers are employees", "All employees are engineers", "Some engineers are not employees", "No conclusion follows"], 0, "Transitive relation: engineers ⊂ graduates ⊂ employees."],
      ["In a row of 40 students, Anil is 12th from the left and Bina is 15th from the right. How many students sit between them?", ["12", "13", "11", "14"], 0, "Anil is 29th from the right; between them: 29 − 15 − 1 = 13? Positions: 28 − 15 − 1 = 12."],
      ["If it rains, the match will be cancelled. It did not rain. Which statement is correct?", ["The match may or may not be cancelled", "The match was cancelled", "The match was not cancelled", "The match will be cancelled later"], 0, "The rule only applies when it rains; no conclusion can be drawn otherwise."],
      ["Find the next number: 3, 7, 16, 35, __", ["74", "70", "72", "76"], 0, "Pattern: ×2 + 1, ×2 + 2, ×2 + 3, ×2 + 4 = 74."],
      ["How many handshakes take place if 8 people each shake hands once with every other person?", ["28", "56", "36", "24"], 0, "C(8, 2) = 28."],
      ["Ravi is 3 years older than Suresh. Their ages sum to 27. How old is Ravi?", ["15", "12", "14", "16"], 0, "R + (R − 3) = 27, so 2R = 30, R = 15."],
      ["Two fair dice are rolled. What is the probability that the sum is 7?", ["1/6", "1/12", "1/9", "1/8"], 0, "Six of 36 outcomes sum to 7: 6/36 = 1/6."],
    ],
  },
  English: {
    easy: [
      ["What is the plural of 'child'?", ["children", "childs", "childes", "childrens"], 0, "'Child' has the irregular plural 'children'."],
      ["What is the past tense of 'go'?", ["went", "goed", "gone", "going"], 0, "'Go' is irregular; its past tense is 'went'."],
      ["Choose the synonym of 'happy'.", ["joyful", "angry", "tired", "weak"], 0, "'Joyful' means happy."],
      ["Choose the antonym of 'ancient'.", ["modern", "old", "historic", "aged"], 0, "'Modern' is the opposite of ancient."],
      ["Choose the correctly spelled word.", ["necessary", "neccessary", "necesary", "neccesary"], 0, "'Necessary' has one 'c' and two 's'."],
      ["She ____ to school every day.", ["goes", "go", "going", "gone"], 0, "Third-person singular takes 'goes'."],
      ["A person who writes books is called:", ["an author", "an editor", "a reader", "a printer"], 0, "An author writes books."],
      ["____ apple a day keeps the doctor away.", ["An", "A", "The", "No article"], 0, "'Apple' begins with a vowel sound, so 'an'."],
      ["They ____ playing cricket.", ["are", "is", "am", "was"], 0, "Plural subject takes 'are'."],
    ],
    medium: [
      ["Choose the synonym of 'abundant'.", ["plentiful", "scarce", "rare", "light"], 0, "'Plentiful' means abundant."],
      ["Choose the antonym of 'transparent'.", ["opaque", "clear", "glassy", "light"], 0, "'Opaque' means not transparent."],
      ["The idiom 'to bite the bullet' means:", ["to endure a difficult situation bravely", "to eat quickly", "to speak rudely", "to avoid a problem"], 0, "It means to face something painful with courage."],
      ["Neither of the boys ____ present.", ["was", "were", "are", "have been"], 0, "'Neither of' takes a singular verb."],
      ["Change to passive voice: 'She wrote a letter.'", ["A letter was written by her.", "A letter is written by her.", "A letter has written by her.", "A letter was wrote by her."], 0, "Simple past passive: was + past participle."],
      ["Choose the grammatically correct sentence.", ["He has been living here since 2010.", "He is living here since 2010.", "He lives here since 2010.", "He lived here since 2010."], 0, "'Since' with present perfect continuous is correct."],
      ["Government by the people is called:", ["democracy", "monarchy", "oligarchy", "autocracy"], 0, "Democracy means rule by the people."],
      ["He is good ____ mathematics.", ["at", "in", "on", "with"], 0, "The fixed collocation is 'good at'."],
      ["Choose the correctly spelled word.", ["occurrence", "occurence", "ocurrence", "occurrance"], 0, "'Occurrence' has two 'c', two 'r', two 'e'."],
    ],
    hard: [
      ["The idiom 'to play devil's advocate' means:", ["to argue a contrary position to test an idea", "to support evil", "to quarrel angrily", "to stay neutral"], 0, "It means to argue the other side for the sake of debate."],
      ["Had I known about the meeting, I ____ have attended.", ["would", "will", "can", "shall"], 0, "Third conditional takes 'would have'."],
      ["A speech delivered without preparation is called:", ["an extempore", "a eulogy", "a monologue", "an oration"], 0, "Extempore means spoken without preparation."],
      ["Choose the synonym of 'ephemeral'.", ["short-lived", "everlasting", "enormous", "fragile"], 0, "'Ephemeral' means lasting a very short time."],
      ["Choose the antonym of 'meticulous'.", ["careless", "careful", "thorough", "precise"], 0, "'Careless' is the opposite of meticulous."],
      ["Identify the error: 'One of my friend is a doctor.'", ["'friend' should be 'friends'", "No error", "'is' should be 'are'", "'a' should be 'the'"], 0, "'One of' is followed by a plural noun: 'one of my friends'."],
      ["The report, along with the annexures, ____ submitted.", ["was", "were", "have been", "are"], 0, "The verb agrees with 'the report' (singular)."],
      ["A person who loves books is called:", ["a bibliophile", "a bibliographer", "a philatelist", "a lexicographer"], 0, "Bibliophile = lover of books."],
      ["Choose the correct form: 'If I ____ you, I would apologise.'", ["were", "was", "am", "will be"], 0, "Subjunctive mood uses 'were'."],
    ],
  },
  Physics: {
    easy: [
      ["What is the SI unit of force?", ["newton", "joule", "watt", "pascal"], 0, "Force is measured in newtons (N)."],
      ["A 2 kg mass accelerates at 3 m/s². What is the force?", ["6 N", "5 N", "1.5 N", "9 N"], 0, "F = ma = 2 × 3 = 6 N."],
      ["What is the SI unit of energy?", ["joule", "newton", "ampere", "volt"], 0, "Energy is measured in joules."],
      ["A runner covers 100 m in 20 s. What is the average speed?", ["5 m/s", "10 m/s", "2 m/s", "20 m/s"], 0, "Speed = 100 ÷ 20 = 5 m/s."],
      ["Light travels fastest in:", ["vacuum", "water", "glass", "diamond"], 0, "Light is fastest in vacuum."],
      ["What is the SI unit of electric current?", ["ampere", "volt", "ohm", "coulomb"], 0, "Current is measured in amperes."],
      ["At 1 atm pressure, pure water boils at:", ["100 °C", "0 °C", "50 °C", "120 °C"], 0, "Water boils at 100 °C at standard pressure."],
      ["Which instrument measures temperature?", ["thermometer", "barometer", "hygrometer", "ammeter"], 0, "A thermometer measures temperature."],
      ["Newton's first law is also called the law of:", ["inertia", "gravitation", "motion", "action"], 0, "It describes inertia."],
    ],
    medium: [
      ["A body starts from rest with acceleration 2 m/s². Its speed after 5 s is:", ["10 m/s", "5 m/s", "2.5 m/s", "20 m/s"], 0, "v = u + at = 0 + 2 × 5 = 10 m/s."],
      ["A current of 2 A flows through a 5 Ω resistor. What is the voltage?", ["10 V", "2.5 V", "7 V", "0.4 V"], 0, "V = IR = 2 × 5 = 10 V."],
      ["A force of 10 N moves an object 4 m. What is the work done?", ["40 J", "14 J", "2.5 J", "0.4 J"], 0, "W = F × d = 40 J."],
      ["100 J of work is done in 5 s. What is the power?", ["20 W", "500 W", "95 W", "0.05 W"], 0, "P = W ÷ t = 20 W."],
      ["An object of mass 200 g occupies 50 cm³. What is its density?", ["4 g/cm³", "0.25 g/cm³", "250 g/cm³", "10 g/cm³"], 0, "Density = 200 ÷ 50 = 4 g/cm³."],
      ["A 2 kg body moves at 3 m/s. What is its kinetic energy?", ["9 J", "6 J", "18 J", "3 J"], 0, "KE = ½mv² = ½ × 2 × 9 = 9 J."],
      ["Sound cannot travel through:", ["vacuum", "air", "water", "steel"], 0, "Sound needs a medium; it cannot travel through a vacuum."],
      ["Which mirror is used as a rear-view mirror in vehicles?", ["convex mirror", "concave mirror", "plane mirror", "cylindrical mirror"], 0, "Convex mirrors give a wider field of view."],
      ["What is the SI unit of frequency?", ["hertz", "second", "metre", "decibel"], 0, "Frequency is measured in hertz (Hz)."],
    ],
    hard: [
      ["A ball is thrown up at 20 m/s (g = 10 m/s²). Its maximum height is:", ["20 m", "40 m", "10 m", "2 m"], 0, "h = u²/2g = 400 ÷ 20 = 20 m."],
      ["Two 6 Ω resistors in parallel give an equivalent resistance of:", ["3 Ω", "12 Ω", "6 Ω", "1.5 Ω"], 0, "1/R = 1/6 + 1/6, so R = 3 Ω."],
      ["What is the momentum of a 0.5 kg ball moving at 4 m/s?", ["2 kg·m/s", "0.125 kg·m/s", "4.5 kg·m/s", "8 kg·m/s"], 0, "p = mv = 0.5 × 4 = 2 kg·m/s."],
      ["A projectile is launched at 20 m/s at 30° to the horizontal (g = 10 m/s²). Its time of flight is:", ["2 s", "4 s", "1 s", "3 s"], 0, "T = 2u·sinθ ÷ g = 2 × 20 × 0.5 ÷ 10 = 2 s."],
      ["Work done by the centripetal force in uniform circular motion is:", ["zero", "positive", "negative", "depends on speed"], 0, "Force is perpendicular to displacement, so work = 0."],
      ["If the wavelength of a photon doubles, its energy:", ["halves", "doubles", "remains the same", "quadruples"], 0, "E = hc/λ, so energy is inversely proportional to wavelength."],
      ["If momentum doubles while mass stays constant, kinetic energy:", ["quadruples", "doubles", "halves", "remains the same"], 0, "KE = p²/2m, so KE scales with p²."],
      ["The acceleration due to gravity at the centre of the Earth is:", ["zero", "9.8 m/s²", "infinite", "half of 9.8 m/s²"], 0, "g is zero at the centre of a uniform sphere."],
      ["The focal length of a plane mirror is:", ["infinity", "zero", "equal to its size", "negative"], 0, "A plane mirror has an infinite focal length."],
    ],
  },
  Chemistry: {
    easy: [
      ["What is the chemical symbol for gold?", ["Au", "Ag", "Gd", "Go"], 0, "Gold's symbol Au comes from Latin 'aurum'."],
      ["H₂O is the chemical formula for:", ["water", "hydrogen peroxide", "ozone", "ammonia"], 0, "Two hydrogen atoms and one oxygen atom form water."],
      ["What is the atomic number of carbon?", ["6", "12", "4", "8"], 0, "Carbon has 6 protons."],
      ["Which gas is essential for combustion?", ["oxygen", "nitrogen", "carbon dioxide", "helium"], 0, "Combustion needs oxygen."],
      ["What is the pH of pure water at 25 °C?", ["7", "1", "14", "0"], 0, "Pure water is neutral with pH 7."],
      ["What is the common name of NaCl?", ["common salt", "baking soda", "chalk", "vinegar"], 0, "Sodium chloride is common salt."],
      ["Which is the lightest element?", ["hydrogen", "helium", "oxygen", "carbon"], 0, "Hydrogen has atomic number 1."],
      ["Which gas do plants absorb for photosynthesis?", ["carbon dioxide", "oxygen", "nitrogen", "hydrogen"], 0, "Plants absorb CO₂ and release O₂."],
      ["Which acid is present in lemon?", ["citric acid", "acetic acid", "sulphuric acid", "lactic acid"], 0, "Lemons contain citric acid."],
    ],
    medium: [
      ["What is the atomic number of sodium?", ["11", "12", "19", "23"], 0, "Sodium has 11 protons."],
      ["What is the formula of baking soda?", ["NaHCO₃", "Na₂CO₃", "NaOH", "NaCl"], 0, "Baking soda is sodium bicarbonate."],
      ["Gain of electrons in a reaction is called:", ["reduction", "oxidation", "combustion", "sublimation"], 0, "OIL RIG: reduction is gain of electrons."],
      ["The molar mass of H₂O (H = 1, O = 16) is:", ["18 g/mol", "16 g/mol", "20 g/mol", "10 g/mol"], 0, "2 × 1 + 16 = 18 g/mol."],
      ["Avogadro's number is approximately:", ["6.022 × 10²³", "3.14 × 10²³", "1.6 × 10⁻¹⁹", "9.8 × 10²³"], 0, "One mole contains about 6.022 × 10²³ entities."],
      ["Which gas is evolved when zinc reacts with dilute HCl?", ["hydrogen", "oxygen", "chlorine", "carbon dioxide"], 0, "Zn + 2HCl → ZnCl₂ + H₂."],
      ["Which liquid is known as the universal solvent?", ["water", "ethanol", "benzene", "acetone"], 0, "Water dissolves more substances than any other liquid."],
      ["How many electrons does a neutral oxygen atom have?", ["8", "6", "16", "10"], 0, "Oxygen has atomic number 8."],
      ["What is the formula of sulphuric acid?", ["H₂SO₄", "HCl", "HNO₃", "H₂CO₃"], 0, "Sulphuric acid is H₂SO₄."],
    ],
    hard: [
      ["What is the pOH of a 0.01 M NaOH solution?", ["2", "12", "1", "11"], 0, "[OH⁻] = 0.01 M, pOH = −log(0.01) = 2."],
      ["How many moles are there in 44 g of CO₂ (C = 12, O = 16)?", ["1", "2", "0.5", "44"], 0, "Molar mass 44 g/mol, so 44 g = 1 mol."],
      ["What is the pH of a 0.001 M HCl solution?", ["3", "11", "1", "0.001"], 0, "HCl fully dissociates: pH = −log(10⁻³) = 3."],
      ["How many moles are there in 18 g of water?", ["1", "2", "18", "0.5"], 0, "18 g ÷ 18 g/mol = 1 mol."],
      ["What is the oxidation state of Mn in KMnO₄?", ["+7", "+4", "+2", "+6"], 0, "K is +1 and each O is −2, so Mn is +7."],
      ["Isotopes of an element have the same:", ["atomic number, different mass number", "mass number", "number of neutrons", "chemical reactivity"], 0, "Isotopes differ in neutrons, hence mass number."],
      ["One mole of any ideal gas at STP occupies:", ["22.4 L", "24 L", "11.2 L", "44 L"], 0, "Molar volume at STP is 22.4 L."],
      ["A compound contains C 40%, H 6.7%, O 53.3%. Its empirical formula is:", ["CH₂O", "CHO", "C₂H₄O", "CH₄O"], 0, "Mole ratio 3.33 : 6.7 : 3.33 = 1 : 2 : 1."],
      ["What is the electronic configuration of chlorine (Z = 17)?", ["2, 8, 7", "2, 8, 8", "2, 7, 8", "8, 2, 7"], 0, "Chlorine fills 2 + 8 + 7 = 17 electrons."],
    ],
  },
  Biology: {
    easy: [
      ["Which organelle is called the powerhouse of the cell?", ["mitochondria", "nucleus", "ribosome", "vacuole"], 0, "Mitochondria generate most of the cell's ATP."],
      ["How many chambers does the human heart have?", ["4", "2", "3", "5"], 0, "Two atria and two ventricles."],
      ["Which gas is released during photosynthesis?", ["oxygen", "carbon dioxide", "nitrogen", "hydrogen"], 0, "Photosynthesis releases O₂."],
      ["What is the largest organ of the human body?", ["skin", "liver", "heart", "brain"], 0, "The skin is the largest organ by surface area and mass."],
      ["Which blood cells fight infection?", ["white blood cells", "red blood cells", "platelets", "plasma"], 0, "Leukocytes defend against pathogens."],
      ["Which pigment makes plants green?", ["chlorophyll", "carotene", "haemoglobin", "melanin"], 0, "Chlorophyll absorbs red and blue light, reflecting green."],
      ["Normal human body temperature is about:", ["37 °C", "40 °C", "35 °C", "42 °C"], 0, "Normal core temperature is about 37 °C."],
      ["How many bones does an adult human body have?", ["206", "300", "180", "240"], 0, "Adults have 206 bones after fusion."],
      ["Which organ pumps blood around the body?", ["heart", "lungs", "kidney", "liver"], 0, "The heart is the circulatory pump."],
    ],
    medium: [
      ["What is the functional unit of the kidney?", ["nephron", "neuron", "alveolus", "villus"], 0, "Each kidney has about a million nephrons."],
      ["Where does protein synthesis take place in a cell?", ["ribosome", "lysosome", "mitochondria", "nucleolus"], 0, "Ribosomes translate mRNA into protein."],
      ["Which mosquito transmits malaria?", ["female Anopheles", "Aedes aegypti", "Culex", "male Anopheles"], 0, "Female Anopheles mosquitoes transmit Plasmodium."],
      ["Which enzyme in saliva begins starch digestion?", ["amylase", "pepsin", "lipase", "trypsin"], 0, "Salivary amylase breaks starch into maltose."],
      ["Which blood group is known as the universal donor?", ["O negative", "AB positive", "A positive", "B negative"], 0, "O negative red cells can be given to almost anyone."],
      ["Which molecule carries oxygen in blood?", ["haemoglobin", "albumin", "fibrin", "insulin"], 0, "Haemoglobin binds oxygen in the lungs."],
      ["What is the largest gland in the human body?", ["liver", "pancreas", "thyroid", "salivary gland"], 0, "The liver is the largest gland."],
      ["Plant cell walls are mainly made of:", ["cellulose", "chitin", "protein", "lipid"], 0, "Cellulose is the main structural component."],
      ["How many pairs of chromosomes do humans have?", ["23", "46", "22", "24"], 0, "23 pairs, one of which is the sex chromosomes."],
    ],
    hard: [
      ["What is the end product of glycolysis?", ["pyruvate", "glucose", "lactate", "acetyl-CoA"], 0, "Glycolysis converts one glucose into two pyruvate molecules."],
      ["Light reactions of photosynthesis occur in the:", ["thylakoid membrane", "stroma", "mitochondrial matrix", "cytoplasm"], 0, "Thylakoid membranes host the light-dependent reactions."],
      ["Which hormone lowers blood glucose?", ["insulin", "glucagon", "adrenaline", "cortisol"], 0, "Insulin promotes glucose uptake from blood."],
      ["In DNA, guanine pairs with:", ["cytosine", "thymine", "adenine", "uracil"], 0, "G–C and A–T are the base pairs."],
      ["The Krebs cycle takes place in the:", ["mitochondrial matrix", "cytosol", "nucleus", "golgi apparatus"], 0, "Also called the citric acid cycle; runs in the matrix."],
      ["Which organelle contains hydrolytic enzymes?", ["lysosome", "ribosome", "chloroplast", "centriole"], 0, "Lysosomes digest cellular waste with acid hydrolases."],
      ["Normal human blood pH range is:", ["7.35–7.45", "6.5–7.0", "7.5–8.0", "5.5–6.5"], 0, "Blood is tightly buffered around pH 7.4."],
      ["What is the main nitrogenous waste in humans?", ["urea", "ammonia", "uric acid", "creatinine"], 0, "The liver converts ammonia to urea for excretion."],
      ["Gas exchange in the lungs occurs at the:", ["alveoli", "bronchi", "trachea", "pleura"], 0, "Alveoli provide the thin diffusion surface."],
    ],
  },
  Mathematics: {
    easy: [
      ["What is sin 30°?", ["1/2", "√3/2", "1", "1/√2"], 0, "sin 30° = 0.5."],
      ["Solve for x > 0: x² = 9.", ["3", "9", "81", "4.5"], 0, "x = √9 = 3."],
      ["What is log₁₀ 100?", ["2", "10", "1", "100"], 0, "10² = 100."],
      ["What is the slope of the line y = 3x + 2?", ["3", "2", "1/3", "-3"], 0, "In y = mx + c, m = 3."],
      ["The sum of the interior angles of a triangle is:", ["180°", "360°", "90°", "270°"], 0, "Triangle angle sum = 180°."],
      ["What is √144?", ["12", "14", "16", "11"], 0, "12² = 144."],
      ["Which is the expansion of (a + b)²?", ["a² + 2ab + b²", "a² + b²", "a² − 2ab + b²", "a² + ab + b²"], 0, "Standard identity."],
      ["What is cos 0°?", ["1", "0", "-1", "1/2"], 0, "cos 0° = 1."],
      ["What is the derivative of x² with respect to x?", ["2x", "x", "x²/2", "2"], 0, "d/dx xⁿ = n·xⁿ⁻¹."],
    ],
    medium: [
      ["What is the sum of the roots of x² − 5x + 6 = 0?", ["5", "6", "-5", "-6"], 0, "Sum of roots = −b/a = 5."],
      ["What is the product of the roots of x² − 5x + 6 = 0?", ["6", "5", "-6", "-5"], 0, "Product of roots = c/a = 6."],
      ["What is ∫ (1/x) dx?", ["ln|x| + C", "x²/2 + C", "1/x² + C", "−ln|x| + C"], 0, "The antiderivative of 1/x is ln|x|."],
      ["What is d/dx (eˣ)?", ["eˣ", "x·eˣ⁻¹", "eˣ/x", "ln x"], 0, "The exponential is its own derivative."],
      ["What is the distance between (0, 0) and (3, 4)?", ["5", "7", "√7", "25"], 0, "√(3² + 4²) = 5."],
      ["What is tan 45°?", ["1", "√3", "1/√3", "0"], 0, "tan 45° = 1."],
      ["What is ⁵C₂?", ["10", "20", "5", "15"], 0, "5!/(2!·3!) = 10."],
      ["What is the discriminant of x² + 2x + 5?", ["−16", "16", "24", "−24"], 0, "b² − 4ac = 4 − 20 = −16."],
      ["log(ab) equals:", ["log a + log b", "log a − log b", "log a × log b", "log a ÷ log b"], 0, "Product rule of logarithms."],
    ],
    hard: [
      ["What is lim(x→0) (sin x)/x?", ["1", "0", "∞", "undefined"], 0, "Standard limit equals 1."],
      ["What is d/dx (ln x)?", ["1/x", "ln x", "x", "eˣ"], 0, "The derivative of the natural logarithm is 1/x."],
      ["What is ∫₀¹ 2x dx?", ["1", "2", "1/2", "0"], 0, "[x²]₀¹ = 1."],
      ["How many real roots does x² + 1 = 0 have?", ["0", "1", "2", "4"], 0, "Discriminant −4 < 0, so no real roots."],
      ["If the roots of x² − kx + 9 = 0 are equal, then k =", ["6", "3", "9", "±3"], 0, "Equal roots require k² = 36; for k > 0, k = 6."],
      ["The sum of the first n natural numbers is:", ["n(n+1)/2", "n²", "n(n−1)/2", "n(n+1)(2n+1)/6"], 0, "Standard arithmetic series formula."],
      ["In the expansion of (1 + x)⁵, the coefficient of x² is:", ["10", "5", "20", "15"], 0, "⁵C₂ = 10."],
      ["sin²θ + cos²θ equals:", ["1", "0", "2", "tan²θ"], 0, "Pythagorean identity."],
      ["A fair coin is tossed three times. What is the probability of exactly two heads?", ["3/8", "1/8", "1/2", "1/3"], 0, "Three of eight outcomes have exactly two heads."],
    ],
  },
  "General Awareness": {
    easy: [
      ["What is the national animal of India?", ["tiger", "lion", "elephant", "peacock"], 0, "The Bengal tiger is India's national animal."],
      ["What is the currency of India?", ["rupee", "dollar", "taka", "yen"], 0, "The Indian rupee (₹) is the national currency."],
      ["Which is the highest mountain peak in the world?", ["Mount Everest", "K2", "Kangchenjunga", "Nanda Devi"], 0, "Everest is 8,849 m above sea level."],
      ["Which is the longest river in India?", ["Ganga", "Yamuna", "Godavari", "Narmada"], 0, "The Ganga is India's longest river."],
      ["What is the national flower of India?", ["lotus", "rose", "marigold", "sunflower"], 0, "The lotus is India's national flower."],
      ["What is the capital of India?", ["New Delhi", "Mumbai", "Kolkata", "Chennai"], 0, "New Delhi is the capital."],
      ["What is the national bird of India?", ["peacock", "parrot", "eagle", "swan"], 0, "The Indian peafowl is the national bird."],
      ["Which planet is known as the Red Planet?", ["Mars", "Venus", "Jupiter", "Mercury"], 0, "Iron oxide dust makes Mars appear red."],
      ["Which is the largest planet in the solar system?", ["Jupiter", "Saturn", "Earth", "Neptune"], 0, "Jupiter is the largest planet."],
    ],
    medium: [
      ["The Constitution of India came into effect on:", ["26 January 1950", "15 August 1947", "26 November 1949", "2 October 1950"], 0, "It was adopted on 26 Nov 1949 and came into force on 26 Jan 1950."],
      ["The Reserve Bank of India was established in:", ["1935", "1947", "1950", "1921"], 0, "The RBI began operations on 1 April 1935."],
      ["ISRO was founded in:", ["1969", "1972", "1965", "1975"], 0, "The Indian Space Research Organisation was formed in 1969."],
      ["How many elected members does the Lok Sabha have at present?", ["543", "545", "552", "500"], 0, "543 members are directly elected."],
      ["The term of the President of India is:", ["5 years", "4 years", "6 years", "7 years"], 0, "Five years, with re-election eligibility."],
      ["Which city is known as the financial capital of India?", ["Mumbai", "New Delhi", "Bengaluru", "Kolkata"], 0, "Mumbai hosts the RBI, BSE and NSE."],
      ["The Tropic of Cancer passes through how many Indian states?", ["8", "6", "10", "12"], 0, "It passes through 8 states."],
      ["Which is the smallest Indian state by area?", ["Goa", "Sikkim", "Tripura", "Manipur"], 0, "Goa is the smallest state by area."],
      ["Who is the nominal head of the Indian state?", ["the President", "the Prime Minister", "the Chief Justice", "the Speaker"], 0, "The President is the constitutional head."],
    ],
    hard: [
      ["The Constitution of India was adopted on:", ["26 November 1949", "26 January 1950", "15 August 1947", "9 December 1946"], 0, "Adoption and commencement are different dates."],
      ["The Directive Principles of State Policy were borrowed from the constitution of:", ["Ireland", "the USA", "the UK", "Canada"], 0, "DPSP was inspired by Ireland."],
      ["Fundamental Duties were added to the Constitution by which amendment?", ["42nd Amendment", "44th Amendment", "52nd Amendment", "73rd Amendment"], 0, "The 42nd Amendment (1976) added Fundamental Duties."],
      ["How many Fundamental Rights are guaranteed by the Constitution?", ["6", "7", "5", "8"], 0, "There are six Fundamental Rights."],
      ["At what age does a Supreme Court judge retire in India?", ["65", "62", "60", "70"], 0, "Supreme Court judges retire at 65."],
      ["The anti-defection law is contained in which Schedule of the Constitution?", ["Tenth Schedule", "Ninth Schedule", "Eighth Schedule", "Seventh Schedule"], 0, "The Tenth Schedule covers disqualification on defection."],
      ["Who was the first woman Prime Minister of India?", ["Indira Gandhi", "Sarojini Naidu", "Pratibha Patil", "Sucheta Kripalani"], 0, "Indira Gandhi served from 1966."],
      ["Which is the highest mountain peak located entirely within India?", ["Kangchenjunga", "Mount Everest", "K2", "Anamudi"], 0, "Kangchenjunga is the highest peak within India's borders."],
      ["Which is the longest river flowing entirely within India?", ["Godavari", "Ganga", "Krishna", "Narmada"], 0, "The Godavari flows entirely within India."],
    ],
  },
};

const SUBJECT_TOPICS: Record<string, string[]> = {
  "Quantitative Aptitude": ["Arithmetic", "Percentage & Interest", "Ratio & Averages"],
  Reasoning: ["Series & Patterns", "Direction & Order", "Coding & Logic"],
  English: ["Grammar", "Vocabulary", "Usage & Idioms"],
  Physics: ["Mechanics", "Electricity & Magnetism", "Waves & Optics"],
  Chemistry: ["Atomic Structure", "Mole Concept", "Acids & Reactions"],
  Biology: ["Cell Biology", "Human Physiology", "Genetics & Ecology"],
  Mathematics: ["Algebra", "Calculus", "Trigonometry & Probability"],
  "General Awareness": ["Indian Polity", "Geography", "Static GK"],
};

type CategoryPlan = {
  slug: string;
  name: string;
  description: string;
  subjects: string[];
  marksPerCorrect: number;
  negativeMarksPerWrong: number;
  tieBreakRules: string[];
  allowPartialCredit: boolean;
};

const CATEGORY_PLANS: CategoryPlan[] = [
  {
    slug: "neet",
    name: "NEET",
    description: "Medical entrance practice covering Biology, Physics and Chemistry.",
    subjects: ["Biology", "Physics", "Chemistry"],
    marksPerCorrect: 4,
    negativeMarksPerWrong: 1,
    tieBreakRules: ["ACCURACY_DESC", "WRONG_ASC"],
    allowPartialCredit: false,
  },
  {
    slug: "jee-main",
    name: "JEE Main",
    description: "Engineering entrance practice covering Physics, Chemistry and Mathematics.",
    subjects: ["Physics", "Chemistry", "Mathematics"],
    marksPerCorrect: 4,
    negativeMarksPerWrong: 1,
    tieBreakRules: ["ACCURACY_DESC", "WRONG_ASC"],
    allowPartialCredit: true,
  },
  {
    slug: "ssc",
    name: "SSC",
    description: "Staff Selection Commission practice: reasoning, aptitude and English.",
    subjects: ["Reasoning", "Quantitative Aptitude", "English"],
    marksPerCorrect: 2,
    negativeMarksPerWrong: 0,
    tieBreakRules: ["ACCURACY_DESC"],
    allowPartialCredit: false,
  },
  {
    slug: "banking",
    name: "Banking",
    description: "Bank PO and clerk practice: aptitude, reasoning and English.",
    subjects: ["Quantitative Aptitude", "Reasoning", "English"],
    marksPerCorrect: 2,
    negativeMarksPerWrong: 0,
    tieBreakRules: ["ACCURACY_DESC"],
    allowPartialCredit: false,
  },
  {
    slug: "railway",
    name: "Railway",
    description: "Railway recruitment practice: reasoning, aptitude and general awareness.",
    subjects: ["Reasoning", "Quantitative Aptitude", "General Awareness"],
    marksPerCorrect: 2,
    negativeMarksPerWrong: 0,
    tieBreakRules: ["ACCURACY_DESC"],
    allowPartialCredit: false,
  },
  {
    slug: "cuet",
    name: "CUET",
    description: "University entrance practice: English, reasoning and general awareness.",
    subjects: ["English", "Reasoning", "General Awareness"],
    marksPerCorrect: 2,
    negativeMarksPerWrong: 0,
    tieBreakRules: [],
    allowPartialCredit: false,
  },
];

const DEMO_STUDENTS = [
  { username: "demo_aarti", name: "Aarti Sharma", state: "Delhi", skill: 0.92 },
  { username: "demo_rohan", name: "Rohan Verma", state: "Uttar Pradesh", skill: 0.8 },
  { username: "demo_sneha", name: "Sneha Iyer", state: "Tamil Nadu", skill: 0.7 },
  { username: "demo_vikram", name: "Vikram Singh", state: "Rajasthan", skill: 0.62 },
  { username: "demo_priya", name: "Priya Nair", state: "Kerala", skill: 0.54 },
  { username: "demo_arjun", name: "Arjun Das", state: "West Bengal", skill: 0.46 },
  { username: "demo_neha", name: "Neha Gupta", state: "Madhya Pradesh", skill: 0.38 },
  { username: "demo_karan", name: "Karan Patel", state: "Gujarat", skill: 0.3 },
];

const DIFFICULTY_PLANS = [
  { difficulty: "EASY", duration: 20, questionCount: 6 },
  { difficulty: "MEDIUM", duration: 30, questionCount: 6 },
  { difficulty: "HARD", duration: 40, questionCount: 6 },
];

async function wipe() {
  // Order matters for referential integrity (SQLite has no ON DELETE CASCADE
  // for every relation in this schema; delete children first).
  await prisma.rankingSnapshot.deleteMany();
  await prisma.userAchievement.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.integrityAlert.deleteMany();
  await prisma.proctoringSession.deleteMany();
  await prisma.attemptEvent.deleteMany();
  await prisma.attemptAnswer.deleteMany();
  await prisma.resultSubjectScore.deleteMany();
  await prisma.result.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.examQuestion.deleteMany();
  await prisma.examSection.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.examSeries.deleteMany();
  await prisma.questionVersion.deleteMany();
  await prisma.questionOption.deleteMany();
  await prisma.question.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.category.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.consentRecord.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.systemSetting.deleteMany();
}

async function main() {
  const demoMode = process.env.SEED_DEMO_DATA !== "false";
  console.info(`[seed] starting (demoMode=${demoMode})`);
  await wipe();

  // Achievements catalogue
  for (const entry of Object.values(ACHIEVEMENTS)) {
    await prisma.achievement.create({
      data: { code: entry.code, title: entry.title, description: entry.description, icon: entry.icon },
    });
  }

  await prisma.systemSetting.createMany({
    data: [
      { key: "maintenance_mode", value: "false" },
      { key: "registration_open", value: "true" },
    ],
  });

  // Subjects + topics
  const subjectIds = new Map<string, { id: string; topicIds: string[] }>();
  for (const [subjectName, topics] of Object.entries(SUBJECT_TOPICS)) {
    const subject = await prisma.subject.create({
      data: { slug: subjectName.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name: subjectName },
    });
    const topicIds: string[] = [];
    for (const topicName of topics) {
      const topic = await prisma.topic.create({
        data: { subjectId: subject.id, slug: topicName.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name: topicName },
      });
      topicIds.push(topic.id);
    }
    subjectIds.set(subjectName, { id: subject.id, topicIds });
  }

  // Staff users
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "RankForge!Admin1";
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@rankforge.local";
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      username: "admin",
      displayName: "RankForge Administrator",
      role: "SUPER_ADMIN",
      passwordHash: await hashPassword(adminPassword),
      emailVerifiedAt: new Date(),
    },
  });
  await prisma.user.create({
    data: {
      email: "manager@rankforge.local",
      username: "exam_manager",
      displayName: "Examination Manager",
      role: "EXAM_MANAGER",
      passwordHash: await hashPassword(adminPassword),
      emailVerifiedAt: new Date(),
    },
  });
  await prisma.user.create({
    data: {
      email: "editor@rankforge.local",
      username: "question_editor",
      displayName: "Question Editor",
      role: "QUESTION_EDITOR",
      passwordHash: await hashPassword(adminPassword),
      emailVerifiedAt: new Date(),
    },
  });

  // Question bank
  const provenance = {
    source: "RankForge original practice item",
    license: "Original content created for this deployment",
  };
  const questionsByKey = new Map<string, string[]>();
  for (const [subjectName, tiers] of Object.entries(BANK)) {
    const subject = subjectIds.get(subjectName)!;
    for (const [difficulty, items] of Object.entries(tiers)) {
      const ids: string[] = [];
      for (let i = 0; i < items.length; i++) {
        const [text, options, correctIndex, explanation] = items[i];
        const topicId = subject.topicIds[i % subject.topicIds.length];
        const question = await prisma.question.create({
          data: {
            subjectId: subject.id,
            topicId,
            difficulty: difficulty.toUpperCase(),
            type: "SINGLE_CHOICE",
            text,
            explanation,
            source: provenance.source,
            license: provenance.license,
            status: "PUBLISHED",
            version: 1,
            createdById: admin.id,
            reviewedById: admin.id,
            reviewedAt: new Date(),
            options: {
              create: options.map((optionText, optionIndex) => ({
                text: optionText,
                isCorrect: optionIndex === correctIndex,
                sortOrder: optionIndex,
              })),
            },
          },
        });
        ids.push(question.id);
      }
      questionsByKey.set(`${subjectName}|${difficulty.toUpperCase()}`, ids);
    }
  }

  // Categories, exams, sections, exam questions
  const createdExams: { id: string; slug: string; title: string; durationMinutes: number; difficulty: string }[] = [];
  for (const plan of CATEGORY_PLANS) {
    const category = await prisma.category.create({
      data: { slug: plan.slug, name: plan.name, description: plan.description, sortOrder: CATEGORY_PLANS.indexOf(plan) },
    });

    for (const dp of DIFFICULTY_PLANS) {
      const exam = await prisma.exam.create({
        data: {
          slug: `${plan.slug}-${dp.difficulty.toLowerCase()}-mock-1`,
          title: `${plan.name} ${dp.difficulty.charAt(0) + dp.difficulty.slice(1).toLowerCase()} Mock Test 1`,
          description: `${dp.difficulty} difficulty mock test for ${plan.name}. ${plan.subjects.length} section(s), ${dp.questionCount} questions per section, ${dp.duration} minutes.`,
          categoryId: category.id,
          difficulty: dp.difficulty,
          durationMinutes: dp.duration,
          marksPerCorrect: plan.marksPerCorrect,
          negativeMarksPerWrong: plan.negativeMarksPerWrong,
          allowPartialCredit: plan.allowPartialCredit,
          shuffleQuestions: true,
          shuffleOptions: true,
          maxAttempts: null,
          status: "ACTIVE",
          publishResultsImmediately: true,
          revealSolutions: true,
          requiresDesktop: false,
          maxFocusWarnings: 5,
          tieBreakRules: JSON.stringify(plan.tieBreakRules),
          instructions:
            `This is a ${dp.duration}-minute practice mock test. Each section has ${dp.questionCount} questions. ` +
            `Marks: +${plan.marksPerCorrect} per correct answer` +
            (plan.negativeMarksPerWrong > 0 ? `, −${plan.negativeMarksPerWrong} per incorrect answer.` : ", no negative marking.") +
            " Questions and options are shuffled per candidate. Answers save automatically and the server enforces the deadline.",
          createdById: admin.id,
        },
      });

      for (let s = 0; s < plan.subjects.length; s++) {
        const subjectName = plan.subjects[s];
        const subject = subjectIds.get(subjectName)!;
        const section = await prisma.examSection.create({
          data: {
            examId: exam.id,
            subjectId: subject.id,
            title: subjectName === "Mathematics" ? "Mathematics" : subjectName,
            questionCount: dp.questionCount,
            sortOrder: s,
          },
        });
        const pool = questionsByKey.get(`${subjectName}|${dp.difficulty}`) ?? [];
        let order = 0;
        for (const questionId of pool) {
          await prisma.examQuestion.create({
            data: { examId: exam.id, questionId, sectionId: section.id, orderIndex: order++ },
          });
        }
      }
      createdExams.push({
        id: exam.id,
        slug: exam.slug,
        title: exam.title,
        durationMinutes: exam.durationMinutes,
        difficulty: exam.difficulty,
      });
    }
  }

  // A mock-test series (NEET) with an explicit, published formula.
  const neetCategory = await prisma.category.findUniqueOrThrow({ where: { slug: "neet" } });
  const series = await prisma.examSeries.create({
    data: {
      slug: "neet-mock-series-1",
      name: "NEET Mock Series 1",
      description:
        "Three NEET-style mock tests (Easy, Medium, Hard). Series ranking = average of your best percentage in each test (SUM_OF_BEST_PERCENTAGE).",
      categoryId: neetCategory.id,
      formula: "SUM_OF_BEST_PERCENTAGE",
    },
  });
  await prisma.exam.updateMany({
    where: { slug: { in: ["neet-easy-mock-1", "neet-medium-mock-1", "neet-hard-mock-1"] } },
    data: { seriesId: series.id },
  });

  if (!demoMode) {
    console.info("[seed] demo data disabled; finished with content and staff only.");
    printSummary(adminEmail, adminPassword, null, 0, await prisma.exam.count());
    return;
  }

  // Demo students + deterministic attempts/results
  const demoPassword = process.env.SEED_DEMO_PASSWORD || "RankForge!Demo1";
  const demoPasswordHash = await hashPassword(demoPassword);
  const demoExamSlugs = ["neet-easy-mock-1", "neet-medium-mock-1", "neet-hard-mock-1", "jee-main-easy-mock-1", "jee-main-medium-mock-1", "ssc-easy-mock-1", "ssc-medium-mock-1", "banking-easy-mock-1", "railway-easy-mock-1", "cuet-medium-mock-1"];
  const demoExams = createdExams.filter((e) => demoExamSlugs.includes(e.slug));

  let attemptCount = 0;
  for (let u = 0; u < DEMO_STUDENTS.length; u++) {
    const student = DEMO_STUDENTS[u];
    const user = await prisma.user.create({
      data: {
        email: `${student.username}@demo.rankforge.local`,
        username: student.username,
        displayName: student.name,
        role: "STUDENT",
        state: student.state,
        passwordHash: demoPasswordHash,
        emailVerifiedAt: new Date(),
        isDemo: true,
      },
    });

    const examsForUser = demoExams.filter((_, i) => (u + i) % 4 !== 3);
    for (let e = 0; e < examsForUser.length; e++) {
      const examFull = await prisma.exam.findUniqueOrThrow({
        where: { id: examsForUser[e].id },
        include: { sections: { orderBy: { sortOrder: "asc" } } },
      });
      const examQuestions = await prisma.examQuestion.findMany({
        where: { examId: examFull.id, question: { status: "PUBLISHED" }, isDefective: false },
        include: { question: { include: { options: true } } },
      });

      const rng = createRng(`demo-${student.username}-${examFull.slug}`);
      const bySection = new Map<string, typeof examQuestions>();
      for (const eq of examQuestions) {
        const key = eq.sectionId ?? "none";
        bySection.set(key, [...(bySection.get(key) ?? []), eq]);
      }
      const paperQuestions: { questionId: string; sectionId: string | null; optionOrder: string[]; marks: number; negativeMarks: number }[] = [];
      for (const section of examFull.sections) {
        const pool = (bySection.get(section.id) ?? []).slice();
        // deterministic shuffle
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const chosen = pool.slice(0, section.questionCount);
        for (const eq of chosen) {
          paperQuestions.push({
            questionId: eq.questionId,
            sectionId: section.id,
            optionOrder: eq.question.options.map((o) => o.id),
            marks: examFull.marksPerCorrect,
            negativeMarks: examFull.negativeMarksPerWrong,
          });
        }
      }

      const startedAt = new Date(Date.now() - (u + 2) * 86_400_000 - e * 3_600_000);
      const deadlineAt = new Date(startedAt.getTime() + examFull.durationMinutes * 60_000);
      const attempt = await prisma.attempt.create({
        data: {
          userId: user.id,
          examId: examFull.id,
          status: "IN_PROGRESS",
          startedAt,
          deadlineAt,
          seed: `demo-seed-${student.username}-${examFull.slug}`,
          paperJson: JSON.stringify({
            version: 1,
            seed: `demo-seed-${student.username}-${examFull.slug}`,
            generatedAt: startedAt.toISOString(),
            questions: paperQuestions,
          }),
          userAgent: "seed-script",
        },
      });

      for (const pq of paperQuestions) {
        const eq = examQuestions.find((x) => x.questionId === pq.questionId)!;
        const correct = eq.question.options.filter((o) => o.isCorrect).map((o) => o.id);
        const wrongOptions = eq.question.options.filter((o) => !o.isCorrect).map((o) => o.id);
        // Per-question draw, decorrelated across students and exams.
        const roll = createRng(`${student.username}|${examFull.slug}|${pq.questionId}`)();
        let selected: string[] = [];
        if (roll < student.skill) selected = correct;
        else if (roll < student.skill + 0.2 && wrongOptions.length > 0)
          selected = [wrongOptions[Math.floor(rng() * wrongOptions.length)]];
        await prisma.attemptAnswer.create({
          data: {
            attemptId: attempt.id,
            questionId: pq.questionId,
            selectedOptionIds: JSON.stringify(selected),
            visited: true,
          },
        });
      }

      await finalizeAttempt(attempt.id, "student_submit");
      attemptCount++;
    }
  }

  printSummary(adminEmail, adminPassword, demoPassword, attemptCount, await prisma.exam.count());
}

function printSummary(adminEmail: string, adminPassword: string, demoPassword: string | null, attempts = 0, examCount = 0) {
  console.info("\n[seed] complete.");
  console.info(`[seed] exams: ${examCount}`);
  if (demoPassword) {
    console.info(`[seed] demo results generated: ${attempts} attempts for ${DEMO_STUDENTS.length} demo students (isDemo=true).`);
  }
  console.info(`[seed] super admin: ${adminEmail} / ${adminPassword}`);
  console.info(`[seed] staff accounts: manager@rankforge.local, editor@rankforge.local (same password as admin)`);
  if (demoPassword) console.info(`[seed] demo student: demo_aarti@demo.rankforge.local / ${demoPassword}`);
  console.info("[seed] IMPORTANT: demo/seed credentials are for local development only.\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("[seed] failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
