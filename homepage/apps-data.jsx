// Default apps for zwolk. Each references an icon id from ICONS.
const DEFAULT_APPS = [
  { id: 'countdowns', name: 'Countdowns', desc: 'Track the days to anything that matters', meta: 'time', iconId: 'clock', url: '/countdowns' },
  { id: 'wage', name: 'Wage Counter', desc: 'Watch your earnings accumulate in real time', meta: 'money', iconId: 'coins', url: '/wage' },
  { id: 'ipa', name: 'IPA Annotator', desc: 'Mark up and track pronunciation errors in text', meta: 'language', iconId: 'eth', url: '/ipa' },
  { id: 'socratic', name: 'Socratic Argument Mapper', desc: 'Map premises and conclusions on a visual canvas', meta: 'thinking', iconId: 'graph', url: '/socratic' },
  { id: 'omniconvert', name: 'OmniConvert', desc: 'Convert files between formats — JSON, CSV, Markdown, images', meta: 'utility', iconId: 'arrows', url: '/omniconvert' },
];

window.DEFAULT_APPS = DEFAULT_APPS;
