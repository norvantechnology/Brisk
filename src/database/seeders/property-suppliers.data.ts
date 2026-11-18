// Auto-generated from 'My Property Listed suppliers (3).xlsx'

export interface SeedSupplierCategory {
  name: string;
  code: string;
  slug: string;
  description: string;
  displayOrder: number;
}

export interface SeedSupplier {
  name: string;
  slug: string;
  tradingName?: string;
  categoryCode: string;
  typicalService?: string;
  coverageSummary?: string;
  providesElectricity?: boolean;
  providesGas?: boolean;
  displayOrder: number;
}

export interface SeedCountyCollector {
  county: string;
  collectorsRaw: string;
}

export const SEED_SUPPLIER_CATEGORIES: SeedSupplierCategory[] = [
  { name: 'Energy Supplier', code: 'ENERGY', slug: 'energy-suppliers', description: 'Domestic electricity and natural gas suppliers across Ireland', displayOrder: 1 },
  { name: 'Broadband Suppliers', code: 'BROADBAND', slug: 'broadband-suppliers', description: 'High-speed fibre, cable, mobile and fixed wireless broadband providers across Ireland', displayOrder: 2 },
  { name: 'Waste Management', code: 'WASTE_MANAGEMENT', slug: 'waste-management', description: 'Domestic household waste, recycling, and wheelie bin collection services across Irish counties', displayOrder: 3 },
];

export const SEED_ENERGY_SUPPLIERS: SeedSupplier[] = [
  { name: 'Arden Energy', slug: 'arden-energy', categoryCode: 'ENERGY', providesElectricity: true, providesGas: false, displayOrder: 1 },
  { name: 'Bord Gáis Energy', slug: 'bord-gais-energy', categoryCode: 'ENERGY', providesElectricity: true, providesGas: true, displayOrder: 2 },
  { name: 'Community Power', slug: 'community-power', categoryCode: 'ENERGY', providesElectricity: true, providesGas: false, displayOrder: 3 },
  { name: 'Ecopower', slug: 'ecopower', categoryCode: 'ENERGY', providesElectricity: true, providesGas: false, displayOrder: 4 },
  { name: 'Energia', slug: 'energia', categoryCode: 'ENERGY', providesElectricity: true, providesGas: true, displayOrder: 5 },
  { name: 'Electric Ireland', slug: 'electric-ireland', categoryCode: 'ENERGY', providesElectricity: true, providesGas: true, displayOrder: 6 },
  { name: 'Flogas', slug: 'flogas', categoryCode: 'ENERGY', providesElectricity: true, providesGas: true, displayOrder: 7 },
  { name: 'Pinergy', slug: 'pinergy', categoryCode: 'ENERGY', providesElectricity: true, providesGas: false, displayOrder: 8 },
  { name: 'PrePayPower (Yuno Ltd)', slug: 'prepaypower-yuno-ltd', tradingName: 'Yuno Ltd', categoryCode: 'ENERGY', providesElectricity: true, providesGas: true, displayOrder: 9 },
  { name: 'Yuno Energy (Yuno Ltd)', slug: 'yuno-energy-yuno-ltd', tradingName: 'Yuno Ltd', categoryCode: 'ENERGY', providesElectricity: true, providesGas: true, displayOrder: 10 },
  { name: 'SSE Airtricity', slug: 'sse-airtricity', categoryCode: 'ENERGY', providesElectricity: true, providesGas: true, displayOrder: 11 },
  { name: 'Water Power', slug: 'water-power', categoryCode: 'ENERGY', providesElectricity: true, providesGas: false, displayOrder: 12 },
];

export const SEED_BROADBAND_SUPPLIERS: SeedSupplier[] = [
  { name: 'eir', slug: 'eir', categoryCode: 'BROADBAND', typicalService: 'Full fibre, part-fibre and copper broadband; nationwide coverage via Open Eir and other networks.', displayOrder: 1 },
  { name: 'Vodafone Ireland', slug: 'vodafone-ireland', categoryCode: 'BROADBAND', typicalService: 'Fibre, part-fibre and mobile/fixed-wireless options; major retail broadband provider.', displayOrder: 2 },
  { name: 'Virgin Media Ireland', slug: 'virgin-media-ireland', categoryCode: 'BROADBAND', typicalService: 'Cable and fibre broadband, mainly in its own cable-network footprint.', displayOrder: 3 },
  { name: 'Sky Ireland', slug: 'sky-ireland', categoryCode: 'BROADBAND', typicalService: 'Fibre and part-fibre broadband, commonly sold over Open Eir/SIRO infrastructure.', displayOrder: 4 },
  { name: 'Pure Telecom', slug: 'pure-telecom', categoryCode: 'BROADBAND', typicalService: 'Fibre and part-fibre broadband for homes.', displayOrder: 5 },
  { name: 'Digiweb', slug: 'digiweb', categoryCode: 'BROADBAND', typicalService: 'Fibre, fixed-wireless and other broadband services; significant rural coverage.', displayOrder: 6 },
  { name: 'Three Ireland', slug: 'three-ireland', categoryCode: 'BROADBAND', typicalService: 'Home broadband, including fixed-wireless/5G-based services.', displayOrder: 7 },
  { name: 'Imagine', slug: 'imagine', categoryCode: 'BROADBAND', typicalService: 'Fibre, 5G home broadband and fixed-wireless services, with a focus on rural areas.', displayOrder: 8 },
  { name: 'Rural WiFi', slug: 'rural-wifi', categoryCode: 'BROADBAND', typicalService: 'Fixed-wireless and rural broadband services.', displayOrder: 9 },
  { name: 'Airwave Internet', slug: 'airwave-internet', categoryCode: 'BROADBAND', typicalService: 'Nationwide-listed broadband provider in ComReg’s service-provider register.', displayOrder: 10 },
  { name: 'Aptus Broadband', slug: 'aptus-broadband', categoryCode: 'BROADBAND', typicalService: 'Nationwide-listed broadband provider in ComReg’s register.', displayOrder: 11 },
  { name: 'Arden Brisknet', slug: 'arden-brisknet', categoryCode: 'BROADBAND', typicalService: 'Nationwide-listed broadband provider in ComReg’s register.', displayOrder: 12 },
  { name: 'BBnet', slug: 'bbnet', categoryCode: 'BROADBAND', typicalService: 'Nationwide-listed broadband provider in ComReg’s register.', displayOrder: 13 },
  { name: 'Beacon Broadband', slug: 'beacon-broadband', categoryCode: 'BROADBAND', typicalService: 'Nationwide-listed broadband provider in ComReg’s register.', displayOrder: 14 },
  { name: 'Blacknight', slug: 'blacknight', categoryCode: 'BROADBAND', typicalService: 'Nationwide-listed broadband provider in ComReg’s register.', displayOrder: 15 },
  { name: 'Cellnet', slug: 'cellnet', categoryCode: 'BROADBAND', typicalService: 'Nationwide-listed broadband provider in ComReg’s register.', displayOrder: 16 },
  { name: 'Airwire', slug: 'airwire', categoryCode: 'BROADBAND', typicalService: 'Regional provider covering Galway, Clare, Mayo, Roscommon, Westmeath, Dublin, Limerick, Tipperary, Laois and Offaly.', displayOrder: 17 },
  { name: 'Advantage Communications', slug: 'advantage-communications', categoryCode: 'BROADBAND', typicalService: 'Regional provider in the North West.', displayOrder: 18 },
  { name: 'Atlantek Computers / MayoFibre.ie', slug: 'atlantek-computers-mayofibre-ie', categoryCode: 'BROADBAND', typicalService: 'Regional/national-listed provider.', displayOrder: 19 },
  { name: 'Arra Communications', slug: 'arra-communications', categoryCode: 'BROADBAND', typicalService: 'Regional provider.', displayOrder: 20 },
  { name: 'Budget Broadband / Ubiquitous / Web World', slug: 'budget-broadband-ubiquitous-web-world', categoryCode: 'BROADBAND', typicalService: 'Nationwide-listed provider.', displayOrder: 21 },
  { name: 'Cablecomm', slug: 'cablecomm', categoryCode: 'BROADBAND', typicalService: 'Local provider in Longford Town.', displayOrder: 22 },
  { name: 'Carnsore Broadband', slug: 'carnsore-broadband', categoryCode: 'BROADBAND', typicalService: 'Local provider in Wexford.', displayOrder: 23 },
];

export const SEED_WASTE_SUPPLIERS: SeedSupplier[] = [
  { name: 'Panda (includes Greenstar and related brands)', slug: 'panda-includes-greenstar-and-related-brands', tradingName: 'includes Greenstar and related brands', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Dublin, Meath, Kildare, Wicklow, Louth, Carlow, Laois, Offaly, Galway, Sligo, Waterford, Wexford, Westmeath and other areas.', displayOrder: 1 },
  { name: 'Oxigen Environmental', slug: 'oxigen-environmental', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Dublin, Kildare, Meath, Louth, Carlow, Laois, Offaly, Cavan, Kilkenny, Tipperary, Waterford, Wexford, Westmeath, Longford, Monaghan and other areas.', displayOrder: 2 },
  { name: 'AES / Bord na Móna Recycling', slug: 'aes-bord-na-mona-recycling', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Carlow, Kildare, Laois, Meath, Offaly, Westmeath, Wexford, Wicklow, Clare, Limerick, Tipperary and other areas.', displayOrder: 3 },
  { name: 'The City Bin Co.', slug: 'the-city-bin-co', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Galway city and county; also Dublin city and South Dublin.', displayOrder: 4 },
  { name: 'Thorntons Recycling', slug: 'thorntons-recycling', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Dublin city, South Dublin, Kildare, Meath and Wicklow.', displayOrder: 5 },
  { name: 'Greyhound Recycling', slug: 'greyhound-recycling', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Dublin city, Dún Laoghaire–Rathdown, Fingal and South Dublin.', displayOrder: 6 },
  { name: 'Mr Binman', slug: 'mr-binman', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Limerick city and county, Clare, Tipperary, Galway, Cork and Laois.', displayOrder: 7 },
  { name: 'Country Clean Recycling', slug: 'country-clean-recycling', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Cork city and county, Limerick, Kilkenny, Tipperary and Waterford.', displayOrder: 8 },
  { name: 'Clean Ireland Recycling', slug: 'clean-ireland-recycling', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Clare, Limerick, Tipperary and Waterford.', displayOrder: 9 },
  { name: 'Barna Recycling', slug: 'barna-recycling', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Galway city and county, Mayo, Leitrim, Roscommon, Sligo, Tipperary and Westmeath.', displayOrder: 10 },
  { name: 'Allied Recycling', slug: 'allied-recycling', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Cavan, Kildare, Meath, Westmeath and other nearby areas.', displayOrder: 11 },
  { name: 'KeyGreen / Key Waste Management', slug: 'keygreen-key-waste-management', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Dublin city and South Dublin', displayOrder: 12 },
  { name: 'Wiser Recycling', slug: 'wiser-recycling', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Cork city and county.', displayOrder: 13 },
  { name: 'Clonmel Waste Disposal / Dungarvan Recycling', slug: 'clonmel-waste-disposal-dungarvan-recycling', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Tipperary and Waterford.', displayOrder: 14 },
  { name: 'AWD Group', slug: 'awd-group', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Wexford and Wicklow.', displayOrder: 15 },
  { name: 'Wilton Waste Recycling', slug: 'wilton-waste-recycling', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Cavan', displayOrder: 16 },
  { name: 'Blue Dolphin Environmental', slug: 'blue-dolphin-environmental', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Monaghan', displayOrder: 17 },
  { name: 'McElvaney Waste', slug: 'mcelvaney-waste', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Monaghan', displayOrder: 18 },
  { name: 'Mahony Environmental', slug: 'mahony-environmental', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Monaghan', displayOrder: 19 },
  { name: 'Doheny Wheelie Bins & Recycling', slug: 'doheny-wheelie-bins-recycling', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Kilkenny', displayOrder: 20 },
  { name: 'Ray Whelan Wheelie Bins', slug: 'ray-whelan-wheelie-bins', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Carlow', displayOrder: 21 },
  { name: 'Killarney Waste Disposal / KWD Recycling', slug: 'killarney-waste-disposal-kwd-recycling', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Kerry', displayOrder: 22 },
  { name: 'Higgins Waste', slug: 'higgins-waste', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Kerry', displayOrder: 23 },
  { name: 'Dillon Waste', slug: 'dillon-waste', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Kerry', displayOrder: 24 },
  { name: 'Bourke Waste Removal', slug: 'bourke-waste-removal', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Mayo', displayOrder: 25 },
  { name: 'McGrath Waste', slug: 'mcgrath-waste', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Mayo', displayOrder: 26 },
  { name: 'Ballinrobe Waste Disposal', slug: 'ballinrobe-waste-disposal', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Mayo', displayOrder: 27 },
  { name: 'Sweeney Recycling', slug: 'sweeney-recycling', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Mayo', displayOrder: 28 },
  { name: 'Mulleadys', slug: 'mulleadys', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Longford, Leitrim, Roscommon and Westmeath', displayOrder: 29 },
  { name: 'Ecoway Waste Management', slug: 'ecoway-waste-management', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Longford', displayOrder: 30 },
  { name: 'Phoenix Waste', slug: 'phoenix-waste', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Louth', displayOrder: 31 },
  { name: 'Ryan Brothers Environmental Services', slug: 'ryan-brothers-environmental-services', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Tipperary', displayOrder: 32 },
  { name: 'Quality Recycling', slug: 'quality-recycling', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Tipperary', displayOrder: 33 },
  { name: 'CDS Waste Management', slug: 'cds-waste-management', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Tipperary', displayOrder: 34 },
  { name: 'Moran Refuse Services', slug: 'moran-refuse-services', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Galway', displayOrder: 35 },
  { name: 'Walsh Waste', slug: 'walsh-waste', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Galway', displayOrder: 36 },
  { name: 'Athchursail Aran Teo', slug: 'athchursail-aran-teo', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Galway / Aran Islands', displayOrder: 37 },
  { name: 'Donegal Waste & Recycle', slug: 'donegal-waste-recycle', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Donegal', displayOrder: 38 },
  { name: 'DM Waste', slug: 'dm-waste', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Donegal', displayOrder: 39 },
  { name: 'Logan Waste', slug: 'logan-waste', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Donegal', displayOrder: 40 },
  { name: 'Sharkey Waste Recycling', slug: 'sharkey-waste-recycling', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Donegal', displayOrder: 41 },
  { name: 'The Binmen / Fly’s Waste Management', slug: 'the-binmen-fly-s-waste-management', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Donegal', displayOrder: 42 },
  { name: 'Advanced Waste Recycling', slug: 'advanced-waste-recycling', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'South Dublin', displayOrder: 43 },
  { name: 'Clearer Waste Management', slug: 'clearer-waste-management', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Dublin city', displayOrder: 44 },
  { name: 'Envirogreen Polymers', slug: 'envirogreen-polymers', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Dublin city', displayOrder: 45 },
  { name: 'Tommy’s Waste and Recycling', slug: 'tommy-s-waste-and-recycling', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Dublin city', displayOrder: 46 },
  { name: 'CMS Waste Disposal', slug: 'cms-waste-disposal', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Westmeath', displayOrder: 47 },
  { name: 'Greener Families', slug: 'greener-families', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Cork county', displayOrder: 48 },
  { name: 'Kollect on Demand', slug: 'kollect-on-demand', categoryCode: 'WASTE_MANAGEMENT', coverageSummary: 'Waterford', displayOrder: 49 },
];

export const SEED_COUNTY_WASTE_COLLECTORS: SeedCountyCollector[] = [
  { county: 'Carlow', collectorsRaw: 'AES/Bord na Móna, Panda, Oxigen, Ray Whelan.' },
  { county: 'Cavan', collectorsRaw: 'Oxigen, Wilton Waste, Allied Recycling' },
  { county: 'Clare', collectorsRaw: 'Clean Ireland, Mr Binman, AES/Bord na Móna.' },
  { county: 'Cork', collectorsRaw: 'Country Clean, Panda, Wiser, Mr Binman, Killarney Waste.' },
  { county: 'Donegal', collectorsRaw: 'Donegal Waste, DM Waste, Logan Waste, Sharkey Waste, Panda, The Binmen.' },
  { county: 'Dublin', collectorsRaw: 'Greyhound, City Bin, Thorntons, KeyGreen, Panda, Oxigen, Advanced Waste, Clearer Waste, Envirogreen, Tommy’s Waste.' },
  { county: 'Galway', collectorsRaw: 'Barna, City Bin, Panda, Mr Binman, Moran Refuse, Walsh Waste, Athchursail Aran.' },
  { county: 'Kerry', collectorsRaw: 'Killarney Waste, Higgins Waste, Dillon Waste.' },
  { county: 'Kildare', collectorsRaw: 'AES/Bord na Móna, Oxigen, Panda, Allied Recycling, Thorntons.' },
  { county: 'Kilkenny', collectorsRaw: 'Doheny Wheelie Bins, Panda, Oxigen, Country Clean.' },
  { county: 'Laois', collectorsRaw: 'AES/Bord na Móna, Oxigen, Mr Binman, Panda.' },
  { county: 'Leitrim', collectorsRaw: 'Barna, Mulleadys, Oxigen.' },
  { county: 'Limerick', collectorsRaw: 'Mr Binman, Clean Ireland, Country Clean, AES/Bord na Móna.' },
  { county: 'Longford', collectorsRaw: 'Mulleadys, Oxigen, Ecoway.' },
  { county: 'Louth', collectorsRaw: 'Oxigen, Panda, Phoenix Waste.' },
  { county: 'Mayo', collectorsRaw: 'Barna, Bourke Waste, McGrath Waste, Ballinrobe Waste, Sweeney Recycling.' },
  { county: 'Meath', collectorsRaw: 'AES/Bord na Móna, Allied Recycling, Oxigen, Panda, Thorntons.' },
  { county: 'Monaghan', collectorsRaw: 'McElvaney Waste, Oxigen, Blue Dolphin, Mahony Environmental.' },
  { county: 'Offaly', collectorsRaw: 'AES, Panda, Oxigen.' },
  { county: 'Roscommon', collectorsRaw: 'AES/Bord na Móna, Barna, Mulleadys.' },
  { county: 'Sligo', collectorsRaw: 'Barna, Panda.' },
  { county: 'Tipperary', collectorsRaw: 'AES/Bord na Móna, Barna, Clean Ireland, Clonmel Waste, Country Clean, Oxigen, Mr Binman, CDS, Ryan Brothers, Quality Recycling.' },
  { county: 'Waterford', collectorsRaw: 'Panda, Oxigen, Clonmel Waste, Clean Ireland, Country Clean, Kollect.' },
  { county: 'Westmeath', collectorsRaw: 'AES/Bord na Móna, Barna, Panda, Mulleadys, Oxigen, Allied Recycling, CMS.' },
  { county: 'Wexford', collectorsRaw: 'AES/Bord na Móna, Panda, Oxigen, AWD Group.' },
  { county: 'Wicklow', collectorsRaw: 'Thorntons, Panda, Oxigen, AES/Bord na Móna, AWD Group.' },
];
