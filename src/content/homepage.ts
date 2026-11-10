/**
 * Homepage curation, used until the historical database (Milestones 3–5) supplies real records.
 *
 * Editorial rule for this file: subjects are identified by NAME and REGION/REALM/FIELD only. No
 * dates, achievements or other claims appear here, because nothing in this file is cited. Once
 * sourced articles exist, these lists are replaced by queries for published, reviewed content.
 */

export type TopicStatus = "planned" | "in-research" | "published";

export interface Topic {
  name: string;
  /** Region, realm, country or field: an identifying label, not a historical claim. */
  context: string;
  status: TopicStatus;
}

const planned = (name: string, context: string): Topic => ({ name, context, status: "planned" });

export const featuredStories: (Topic & { kind: string; summary: string })[] = [
  {
    ...planned("The Complete History of the Buganda Kingdom", "East Africa · present-day Uganda"),
    kind: "Kingdom",
    summary:
      "The first full HISTORYVERSE project: a sourced article, archival media and a documentary, built end to end.",
  },
  {
    ...planned("The History of Uganda", "East Africa"),
    kind: "Country",
    summary:
      "From early societies and kingdoms through the colonial period to independence and beyond.",
  },
  {
    ...planned("The Mali Empire", "West Africa"),
    kind: "Empire",
    summary: "One of the great empires of West Africa, its rulers, its cities and its trade.",
  },
];

export const ancientCivilizations: Topic[] = [
  planned("Ancient Egypt", "Nile Valley · North-East Africa"),
  planned("Mesopotamia", "Tigris–Euphrates · Western Asia"),
  planned("Indus Valley Civilisation", "South Asia"),
  planned("Kingdom of Kush", "Nubia · North-East Africa"),
  planned("Ancient China", "East Asia"),
  planned("Ancient Greece", "Eastern Mediterranean"),
  planned("Ancient Rome", "Mediterranean"),
  planned("Maya Civilization", "Mesoamerica"),
];

export const monarchs: Topic[] = [
  planned("Mansa Musa", "Mali Empire"),
  planned("Nzinga Mbande", "Ndongo and Matamba"),
  planned("Mutesa I", "Kingdom of Buganda"),
  planned("Hatshepsut", "Ancient Egypt"),
  planned("Cleopatra VII", "Ptolemaic Egypt"),
  planned("Ashoka", "Maurya Empire"),
  planned("Shaka", "Zulu Kingdom"),
  planned("Elizabeth I", "Kingdom of England"),
];

export const worldLeaders: Topic[] = [
  planned("Nelson Mandela", "South Africa"),
  planned("Kwame Nkrumah", "Ghana"),
  planned("Julius Nyerere", "Tanzania"),
  planned("Ellen Johnson Sirleaf", "Liberia"),
  planned("Jawaharlal Nehru", "India"),
  planned("Simón Bolívar", "South America"),
  planned("Abraham Lincoln", "United States"),
  planned("Charles de Gaulle", "France"),
];

export const africanKingdoms: Topic[] = [
  planned("Kingdom of Buganda", "East Africa · present-day Uganda"),
  planned("Bunyoro-Kitara", "East Africa · present-day Uganda"),
  planned("Kingdom of Aksum", "Horn of Africa"),
  planned("Mali Empire", "West Africa"),
  planned("Songhai Empire", "West Africa"),
  planned("Asante Empire", "West Africa · present-day Ghana"),
  planned("Kingdom of Benin", "West Africa · present-day Nigeria"),
  planned("Kingdom of Kongo", "Central Africa"),
  planned("Great Zimbabwe", "Southern Africa"),
];

export const historicalMysteries: Topic[] = [
  planned("The Undeciphered Indus Script", "South Asia"),
  planned("Rongorongo of Rapa Nui", "Oceania"),
  planned("The Lost Colony of Roanoke", "North America"),
  planned("The Voynich Manuscript", "Europe"),
  planned("The Antikythera Mechanism", "Mediterranean"),
  planned("The Fate of the Library of Alexandria", "North Africa"),
];

export const famousFigures: Topic[] = [
  planned("Ibn Battuta", "Exploration"),
  planned("Ada Lovelace", "Mathematics & computing"),
  planned("Wangari Maathai", "Environment & human rights"),
  planned("Marie Curie", "Science"),
  planned("Ibn Sina", "Medicine & philosophy"),
  planned("Confucius", "Philosophy"),
  planned("Leonardo da Vinci", "Art & invention"),
  planned("Frida Kahlo", "Art"),
];

export type TechIcon =
  | "Globe"
  | "Cpu"
  | "Smartphone"
  | "Car"
  | "Plane"
  | "TrainFront"
  | "Gamepad2"
  | "Camera"
  | "Clapperboard"
  | "Stethoscope";

export const technologyTopics: { name: string; icon: TechIcon }[] = [
  { name: "The Internet", icon: "Globe" },
  { name: "Computers", icon: "Cpu" },
  { name: "Mobile Phones", icon: "Smartphone" },
  { name: "Cars", icon: "Car" },
  { name: "Airplanes", icon: "Plane" },
  { name: "Railways", icon: "TrainFront" },
  { name: "Video Games", icon: "Gamepad2" },
  { name: "Photography", icon: "Camera" },
  { name: "Cinema", icon: "Clapperboard" },
  { name: "Medicine", icon: "Stethoscope" },
];

export const continents: { name: string; examples: string }[] = [
  { name: "Africa", examples: "Aksum, Mali, Buganda, Great Zimbabwe" },
  { name: "Asia", examples: "Mesopotamia, the Indus Valley, the Maurya Empire" },
  { name: "Europe", examples: "Ancient Greece, Rome and the nations of Europe" },
  { name: "North America", examples: "The Maya, Indigenous nations, independence movements" },
  { name: "South America", examples: "Andean civilisations and the wars of independence" },
  { name: "Oceania", examples: "Polynesian voyaging, Rapa Nui, Aboriginal Australia" },
  { name: "Antarctica", examples: "Exploration and science" },
];

/** Suggested starting points. Rankings from real search usage replace these in Milestone 6. */
export const suggestedSearches = [
  "Complete history of Uganda",
  "All kings of Buganda",
  "History of Ancient Egypt",
  "Who was the first president of Ghana?",
  "How did World War I begin?",
  "History of the Mali Empire",
  "Biography of Nelson Mandela",
  "History of the internet",
];
