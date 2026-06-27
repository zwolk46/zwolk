// Default apps for zwolk. Each references an icon id from ICONS.
const DEFAULT_APPS = [
  { id: 'countdowns', name: 'Countdowns', desc: 'Track the days to anything that matters', meta: 'time', iconId: 'clock', url: '/countdowns' },
  { id: 'wage', name: 'Wage Counter', desc: 'Watch your earnings accumulate in real time', meta: 'money', iconId: 'wallet', url: '/wage' },
  { id: 'ipa', name: 'IPA Annotator', desc: 'Mark up and track pronunciation errors in text', meta: 'language', iconId: 'speech', url: '/ipa' },
  { id: 'socratic', name: 'Socratic Argument Mapper', desc: 'Map premises and conclusions on a visual canvas', meta: 'thinking', iconId: 'graph', url: '/socratic' },
  { id: 'omniconvert', name: 'OmniConvert', desc: 'Convert files between formats — JSON, CSV, Markdown, images', meta: 'utility', iconId: 'arrows', url: '/omniconvert' },
  { id: 'northwestern', name: 'Northwestern Events', desc: 'A live calendar of every Northwestern event — academic, athletic, arts, recreation', meta: 'utility', iconId: 'compass', url: '/northwestern' },
  { id: 'quizzes', name: 'Quizzes', desc: 'Build and take quizzes — flashcards, multiple choice, scored review', meta: 'thinking', iconId: 'quiz', url: '/quiz', roles: ['admin'] },
];

window.DEFAULT_APPS = DEFAULT_APPS;
