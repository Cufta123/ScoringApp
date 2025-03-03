const iocToFlagCodeMap = {
  AFG: 'AF',
  ALB: 'AL',
  ALG: 'DZ',
  ASA: 'AS',
  AND: 'AD',
  ANG: 'AO',
  ANT: 'AG',
  ARG: 'AR',
  ARM: 'AM',
  ARU: 'AW',
  SHP: 'SH',
  AUS: 'AU',
  AUT: 'AT',
  AZE: 'AZ',
  BAH: 'BS',
  BRN: 'BH',
  BAN: 'BD',
  BAR: 'BB',
  BLR: 'BY',
  BEL: 'BE',
  BIZ: 'BZ',
  BEN: 'BJ',
  BER: 'BM',
  BHU: 'BT',
  BOL: 'BO',
  BIH: 'BA',
  BOT: 'BW',
  BRA: 'BR',
  BRU: 'BN',
  BUL: 'BG',
  BUR: 'BF',
  BDI: 'BI',
  CPV: 'CV',
  CAM: 'KH',
  CMR: 'CM',
  CAN: 'CA',
  CAY: 'KY',
  CAF: 'CF',
  CHA: 'TD',
  CHI: 'CL',
  CHN: 'CN',
  COL: 'CO',
  COM: 'KM',
  COK: 'CK',
  CRC: 'CR',
  CIV: 'CI',
  CRO: 'HR',
  CUB: 'CU',
  CYP: 'CY',
  CZE: 'CZ',
  COD: 'CD',
  DEN: 'DK',
  DJI: 'DJ',
  DMA: 'DM',
  DOM: 'DO',
  ECU: 'EC',
  EGY: 'EG',
  ESA: 'SV',
  GEQ: 'GQ',
  ERI: 'ER',
  EST: 'EE',
  ETH: 'ET',
  FAI: 'FO',
  FIJ: 'FJ',
  FIN: 'FI',
  FRA: 'FR',
  GAB: 'GA',
  GAM: 'GM',
  GEO: 'GE',
  GER: 'DE',
  GHA: 'GH',
  GRE: 'GR',
  GRN: 'GD',
  GUM: 'GU',
  GUA: 'GT',
  GCI: 'GG',
  GUI: 'GN',
  GBS: 'GW',
  GUY: 'GY',
  HAI: 'HT',
  HON: 'HN',
  HKG: 'HK',
  HUN: 'HU',
  ISL: 'IS',
  IND: 'IN',
  INA: 'ID',
  IRI: 'IR',
  IRQ: 'IQ',
  IRL: 'IE',
  ISR: 'IL',
  ITA: 'IT',
  JAM: 'JM',
  JPN: 'JP',
  JCI: 'JE',
  JOR: 'JO',
  KAZ: 'KZ',
  KEN: 'KE',
  KIR: 'KI',
  PRK: 'KP',
  KOR: 'KR',
  KUW: 'KW',
  KGZ: 'KG',
  LAO: 'LA',
  LAT: 'LV',
  LIB: 'LB',
  LES: 'LS',
  LBR: 'LR',
  LBA: 'LY',
  LIE: 'LI',
  LTU: 'LT',
  LUX: 'LU',
  MAC: 'MO',
  MKD: 'MK',
  MAD: 'MG',
  MAW: 'MW',
  MAS: 'MY',
  MDV: 'MV',
  MLI: 'ML',
  MLT: 'MT',
  MHL: 'MH',
  MTN: 'MR',
  MRI: 'MU',
  MEX: 'MX',
  MDA: 'MD',
  MON: 'MC',
  MGL: 'MN',
  MNE: 'ME',
  MAR: 'MA',
  MOZ: 'MZ',
  MYA: 'MM',
  NAM: 'NA',
  NRU: 'NR',
  NEP: 'NP',
  NED: 'NL',
  NZL: 'NZ',
  NCA: 'NI',
  NIG: 'NE',
  NGR: 'NG',
  NOR: 'NO',
  OMA: 'OM',
  PAK: 'PK',
  PLW: 'PW',
  PLE: 'PS',
  PAN: 'PA',
  PNG: 'PG',
  PAR: 'PY',
  PER: 'PE',
  PHI: 'PH',
  POL: 'PL',
  POR: 'PT',
  PUR: 'PR',
  QAT: 'QA',
  CGO: 'CG',
  ROU: 'RO',
  RUS: 'RU',
  RWA: 'RW',
  SKN: 'KN',
  LCA: 'LC',
  VIN: 'VC',
  SAM: 'WS',
  SMR: 'SM',
  KSA: 'SA',
  SEN: 'SN',
  SRB: 'RS',
  SEY: 'SC',
  SLE: 'SL',
  SIN: 'SG',
  SVK: 'SK',
  SLO: 'SI',
  SOL: 'SB',
  SOM: 'SO',
  RSA: 'ZA',
  ESP: 'ES',
  SRI: 'LK',
  SUD: 'SD',
  SUR: 'SR',
  SWZ: 'SZ',
  SWE: 'SE',
  SUI: 'CH',
  SYR: 'SY',
  STP: 'ST',
  TPE: 'TW',
  TJK: 'TJ',
  TAN: 'TZ',
  THA: 'TH',
  TLS: 'TL',
  TOG: 'TG',
  TGA: 'TO',
  TRI: 'TT',
  TUN: 'TN',
  TUR: 'TR',
  TKM: 'TM',
  TUV: 'TV',
  UGA: 'UG',
  UKR: 'UA',
  UAE: 'AE',
  GBR: 'GB',
  USA: 'US',
  URU: 'UY',
  UZB: 'UZ',
  VAN: 'VU',
  VEN: 'VE',
  VIE: 'VN',
  ISV: 'VI',
  YEM: 'YE',
  ZAM: 'ZM',
  ZIM: 'ZW',
};

export default iocToFlagCodeMap;
