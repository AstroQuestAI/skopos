// Shared TypeScript interfaces for the Vedic Astrology app.
// Extracted from app/index.tsx (v6.6 Phase 1 refactor).

export interface PlanetPosition {
  name: string;
  name_local: string;
  longitude: number;
  sign: string;
  sign_local: string;
  house: number;
  nakshatra: string;
  nakshatra_local: string;
  nakshatra_pada: number;
  retrograde: boolean;
  strength: string;
  strength_local: string;
  degree_in_sign: number;
}

export interface HouseInfo {
  number: number;
  sign: string;
  sign_local: string;
  cusp_longitude: number;
  lord: string;
  lord_local: string;
  lord_house: number;
  planets: string[];
}

export interface ChartData {
  ascendant: number;
  ascendant_sign: string;
  ascendant_sign_local: string;
  ascendant_nakshatra: string;
  ascendant_nakshatra_local: string;
  planets: PlanetPosition[];
  houses: HouseInfo[];
}

export interface Prediction {
  house_number: number;
  house_name: string;
  house_name_local: string;
  signification: string;
  signification_local: string;
  prediction: string;
  prediction_local: string;
}

export interface DashaPeriod {
  planet: string;
  planet_local: string;
  start_date: string;
  end_date: string;
  duration_years: number;
  is_current: boolean;
}

export interface DashaInfo {
  current_mahadasha: DashaPeriod;
  current_antardasha: DashaPeriod;
  mahadasha_sequence: DashaPeriod[];
  current_dasha_prediction: string;
  current_dasha_prediction_local: string;
}

export interface TransitInfo {
  current_date: string;
  transits: PlanetPosition[];
  sade_sati_status: string;
  sade_sati_status_local: string;
  current_effects: string;
  current_effects_local: string;
}

export interface YogaInfo {
  name: string;
  name_local: string;
  description: string;
  description_local: string;
  is_present: boolean;
  polarity?: 'positive' | 'negative' | 'mixed' | 'corrective';
  source?: string;
  source_local?: string;
  meaning_for_you?: string;
  meaning_for_you_local?: string;
}

export interface PlanetAnalysis {
  planet: string;
  planet_local: string;
  analysis: string;
  analysis_local: string;
}

export interface BphsShloka {
  sanskrit: string;
  hindi_meaning: string;
  telugu_translation: string;
  english_translation: string;
  topic: string;
  source: string;
  source_page?: number;
  shloka_number?: string;
}

export interface Remedy {
  planet: string;
  planet_local: string;
  reason: string;
  reason_local: string;
  gemstone: string;
  gemstone_local: string;
  mantra: string;
  mantra_local: string;
  mantra_count: string;
  day_of_week: string;
  day_of_week_local: string;
  color: string;
  color_local: string;
  donation: string;
  donation_local: string;
  worship_deity: string;
  worship_deity_local: string;
}

export interface DailyHoroscope {
  date: string;
  overall_rating: number;
  overall_summary: string;
  overall_summary_local: string;
  tara_bala: string;
  tara_bala_local: string;
  chandra_bala: string;
  chandra_bala_local: string;
  career: string;
  career_local: string;
  health: string;
  health_local: string;
  love: string;
  love_local: string;
  finance: string;
  finance_local: string;
  lucky_color: string;
  lucky_color_local: string;
  lucky_number: number;
  avoid: string;
  avoid_local: string;
}

export interface TimePeriod {
  name: string;
  name_local: string;
  start_time: string;
  end_time: string;
  description: string;
  description_local: string;
  type: string;
}

export interface DaySlot {
  start_time: string;
  end_time: string;
  slot_type: string;
  label: string;
  label_local: string;
  ruler: string;
  ruler_local: string;
  good_for: string[];
  good_for_local: string[];
  avoid: string[];
  avoid_local: string[];
  source?: string;
  score?: number;
  tier?: string;
  tier_local?: string;
  tier_color?: string;
  tier_emoji?: string;
}

export interface MuhuratTimings {
  date: string;
  day_of_week: string;
  day_of_week_local: string;
  sunrise: string;
  sunset: string;
  midday: string;
  personal_tara: string;
  personal_tara_local: string;
  personal_chandra_bala: string;
  personal_chandra_bala_local: string;
  day_rating: string;
  day_rating_local: string;
  auspicious_periods: TimePeriod[];
  inauspicious_periods: TimePeriod[];
  current_hora: string;
  current_hora_local: string;
  recommendation: string;
  recommendation_local: string;
  timeline?: DaySlot[];
  today_good_for?: string[];
  today_good_for_local?: string[];
  today_avoid?: string[];
  today_avoid_local?: string[];
}

export interface AstrologyResponse {
  chart_data: ChartData;
  predictions: Prediction[];
  dasha_info: DashaInfo;
  transit_info: TransitInfo;
  yogas: YogaInfo[];
  planet_analyses: PlanetAnalysis[];
  /** v6.29 — echo of the birth input so frontend can pass it back to
   *  Vidhaata chat without re-asking the user. */
  birth_details?: {
    date?: string;
    time?: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    timezone_offset?: number;
    language?: string;
  };
  moon_sign: string;
  moon_sign_local: string;
  moon_sign_number?: number;          // 0..11 for Chandrabala
  moon_nakshatra: string;
  moon_nakshatra_local: string;
  moon_nakshatra_number?: number;     // 0..26 for Tarabala
  personality_summary: string;
  personality_summary_local: string;
  bphs_references: BphsShloka[];
  dbpc_yogas?: any[];
  dbpc_chart_matches?: any[];
  dbpc_planet_effects?: any[];
  dbpc_bhava_chapter?: any;
  dbpc_bhava_all_chapters?: any[];
  dbpc_yoga_chapters?: any[];
  // v8.4 — dbpc_matched_chart_examples removed with Similar Charts tab.
  remedies: Remedy[];
  remedies_note?: string | null;
  remedies_note_local?: string | null;
  daily_horoscope: DailyHoroscope;
  muhurat_timings: MuhuratTimings;
  navamsa_chart?: NavamsaChart | null;
  classical_concepts?: ClassicalConcepts | null;
}

export interface YutiItem {
  planets: string[];
  planets_local: string[];
  sign: string;
  sign_local: string;
  house: number;
  yoga_name?: string | null;
  yoga_name_local?: string | null;
  effect: string;
  effect_local: string;
}

export interface UdayamuStatus {
  planet: string;
  planet_local: string;
  status: string;
  status_local: string;
  separation_deg: number;
  interpretation: string;
  interpretation_local: string;
}

export interface KarakatwaItem {
  planet: string;
  planet_local: string;
  significations: string[];
  significations_local: string[];
  in_your_chart: string;
  in_your_chart_local: string;
}

export interface ShadbalaItem {
  planet: string;
  planet_local: string;
  sthana_bala: number;
  dig_bala: number;
  kala_bala: number;
  naisargika_bala: number;
  cheshta_bala?: number;
  drik_bala?: number;
  total_bala: number;
  rank: number;
  strength_level: string;
  strength_level_local: string;
  interpretation: string;
  interpretation_local: string;
}

export interface BookConcept {
  concept_key: string;
  title_te: string;
  title_en: string;
  start_page: number;
  end_page: number;
  tags?: string[];
  content_te?: string;
  summary_en?: string;
  source?: string;
}

export interface ClassicalConcepts {
  yutis: YutiItem[];
  udayamu: UdayamuStatus[];
  karakatwa: KarakatwaItem[];
  shadbala: ShadbalaItem[];
  book_concepts: BookConcept[];
}

export interface NavamsaPlanet {
  name: string;
  name_local: string;
  d1_sign: string;
  d1_sign_local: string;
  navamsa_sign: string;
  navamsa_sign_local: string;
  navamsa_house: number;
  dignity: string;
  dignity_local: string;
  vargottama: boolean;
  interpretation: string;
  interpretation_local: string;
}

export interface NavamsaChart {
  navamsa_lagna_sign: string;
  navamsa_lagna_sign_local: string;
  navamsa_lagna_house: number;
  planets: NavamsaPlanet[];
  overall_strength: string;
  overall_strength_local: string;
  marriage_indication: string;
  marriage_indication_local: string;
  dharma_indication: string;
  dharma_indication_local: string;
}

