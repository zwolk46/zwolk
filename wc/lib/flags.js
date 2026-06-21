// FIFA 3-letter code → ISO-2 country code, for local flag SVGs in /wc/flags/.
// Covers all 48 World Cup 2026 teams; sourced from the design's wc26data.js.
export const FLAG = {
  MEX:'mx', KOR:'kr', RSA:'za', CZE:'cz', CAN:'ca', BIH:'ba', QAT:'qa', SUI:'ch',
  SCO:'gb-sct', BRA:'br', MAR:'ma', HAI:'ht', USA:'us', AUS:'au', TUR:'tr', PAR:'py',
  GER:'de', CIV:'ci', ECU:'ec', CUW:'cw', SWE:'se', NED:'nl', JPN:'jp', TUN:'tn',
  BEL:'be', EGY:'eg', IRN:'ir', NZL:'nz', ESP:'es', CPV:'cv', KSA:'sa', URU:'uy',
  NOR:'no', FRA:'fr', SEN:'sn', IRQ:'iq', ARG:'ar', AUT:'at', ALG:'dz', JOR:'jo',
  COL:'co', POR:'pt', COD:'cd', UZB:'uz', ENG:'gb-eng', GHA:'gh', CRO:'hr', PAN:'pa',
};

export const flagSrc = (code) => FLAG[code] ? `/wc/flags/${FLAG[code]}.svg` : null;
