// App-wide styles.
// Extracted from app/index.tsx (v6.6 Phase 1 refactor).

import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { padding: 20 },
  header: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  title: { fontSize: 30, fontWeight: 'bold', color: '#8B5CF6', marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center' },
  versionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F3E8FF', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, marginTop: 10, borderWidth: 1, borderColor: '#E9D5FF',
  },
  versionText: { fontSize: 11, color: '#8B5CF6', fontWeight: '600' },
  languageContainer: { marginBottom: 24 },
  label: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 },
  languageButtons: { flexDirection: 'row', gap: 12 },
  languageButton: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12,
    backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E5E7EB', alignItems: 'center',
  },
  languageButtonActive: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  languageButtonText: { fontSize: 16, fontWeight: '600', color: '#6B7280' },
  languageButtonTextActive: { color: '#FFFFFF' },
  inputContainer: { marginBottom: 20 },
  dateButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', gap: 12,
  },
  dateInputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    paddingHorizontal: 14, paddingVertical: 4, borderRadius: 12, borderWidth: 1,
    borderColor: '#E5E7EB', gap: 10,
  },
  dateTextInput: {
    flex: 1, fontSize: 16, color: '#374151', fontWeight: '500',
    paddingVertical: 14, minHeight: 48,
  },
  pickerIconBtn: {
    padding: 8, marginRight: -4,
  },
  hintText: {
    fontSize: 11, color: '#9CA3AF', marginTop: 4, marginLeft: 4,
  },
  dateText: { fontSize: 16, color: '#374151', fontWeight: '500' },
  locationInputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', gap: 12,
  },
  locationInput: { flex: 1, fontSize: 16, color: '#374151' },
  gpsButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F3E8FF', padding: 12, borderRadius: 12, gap: 8, marginBottom: 10,
    borderWidth: 1, borderColor: '#E9D5FF',
  },
  gpsButtonText: { fontSize: 14, fontWeight: '600', color: '#8B5CF6' },
  suggestionsContainer: {
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    marginTop: 4, maxHeight: 240, overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    gap: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  suggestionText: { fontSize: 15, color: '#374151', fontWeight: '500' },
  suggestionCoords: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  locationConfirm: {
    fontSize: 12, color: '#10B981', marginTop: 6, fontWeight: '600',
  },
  calculateButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#8B5CF6', padding: 18, borderRadius: 12, marginTop: 12, gap: 8,
  },
  calculateButtonText: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  modalContainer: { flex: 1, backgroundColor: '#F9FAFB' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#4338CA' },

  // Tabs — v6.47 Deep-Indigo / Purple theme
  // v8.6.2 — `tabsRow` wraps the horizontal tabs + the new location/time
  // chip on the right end (moved from the cramped AppHeader).
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingRight: 10,
  },
  tabScroll: { backgroundColor: '#FFFFFF', maxHeight: 56, flexShrink: 1 },
  tabContainer: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tab: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.3, borderColor: '#4338CA', gap: 4, backgroundColor: '#FFFFFF',
  },
  tabActive: { backgroundColor: '#4338CA', borderColor: '#312E81' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#4338CA' },
  tabTextActive: { color: '#FFFFFF' },

  // v8.6.8 — Charts page sub-tabs (Rasi / Navamsa / Transits).
  // Smaller pills, left-aligned, sit inside the content area (not the
  // sticky app-wide tab strip) so they visually read as "sub-sections".
  chartSubTabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  chartSubTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    gap: 4,
  },
  chartSubTabActive: {
    backgroundColor: '#4338CA',
    borderColor: '#312E81',
  },
  chartSubTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4338CA',
  },
  chartSubTabTextActive: {
    color: '#FFFFFF',
  },
  // v8.6.2 — location/time chip on tabs row
  locTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    gap: 4,
    marginLeft: 4,
  },
  locTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
    letterSpacing: 0.2,
  },

  resultsScroll: { flex: 1 },

  // Section cards
  sectionCard: {
    backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  highlightCard: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#374151' },
  bodyText: { fontSize: 14, color: '#4B5563', lineHeight: 22 },

  // Overview
  overviewGrid: {
    flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 12,
  },
  overviewCard: {
    width: '47%', padding: 14, borderRadius: 14, alignItems: 'flex-start',
  },
  overviewLabel: { fontSize: 11, color: '#6B7280', marginTop: 6, fontWeight: '600' },
  overviewValue: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginTop: 2 },
  insightRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  insightLabel: { fontSize: 14, color: '#6B7280' },
  insightValue: { fontSize: 14, fontWeight: 'bold', color: '#8B5CF6' },

  // Chart - North Indian Box Style
  chartContainer: { alignItems: 'center', marginVertical: 16 },
  boxChart: {
    width: 320, borderWidth: 2, borderColor: '#8B5CF6', backgroundColor: '#FFFFFF',
  },
  boxRow: { flexDirection: 'row' },
  boxCell: {
    flex: 1, aspectRatio: 1, borderWidth: 1, borderColor: '#8B5CF6',
    padding: 4, justifyContent: 'space-between', backgroundColor: '#FFFFFF',
  },
  boxCellAsc: { backgroundColor: '#F3E8FF' },
  boxHouseNum: {
    position: 'absolute', top: 2, right: 4, fontSize: 10, fontWeight: 'bold', color: '#8B5CF6',
  },
  boxSignName: {
    fontSize: 9, color: '#6B7280', fontWeight: '600', marginTop: 2,
  },
  boxPlanets: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 2 },
  boxPlanet: {
    fontSize: 11, color: '#1F2937', fontWeight: '700', backgroundColor: '#F3E8FF',
    paddingHorizontal: 3, borderRadius: 4, overflow: 'hidden',
  },
  boxCenterEmpty: {
    flex: 2, aspectRatio: 2, borderWidth: 1, borderColor: '#8B5CF6',
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA',
  },
  boxCenterText: {
    fontSize: 13, fontWeight: 'bold', color: '#8B5CF6', letterSpacing: 2,
  },
  boxCenterSubtext: {
    fontSize: 11, color: '#6B7280', fontWeight: '600', letterSpacing: 1,
  },

  // Old chart styles (kept for backwards compat)
  chartGrid: {
    width: 300, height: 300, flexDirection: 'row', flexWrap: 'wrap',
    borderWidth: 2, borderColor: '#8B5CF6', backgroundColor: '#FFFFFF',
  },
  chartCell: {
    width: '25%', height: '25%', borderWidth: 1, borderColor: '#D1D5DB',
    padding: 4, justifyContent: 'flex-start', alignItems: 'flex-start',
  },
  chartCellCorner: { backgroundColor: '#F3E8FF' },
  chartCellTopLeft: { backgroundColor: '#DDD6FE' },
  houseNumber: { fontSize: 10, fontWeight: 'bold', color: '#8B5CF6' },
  ascendantMarker: {
    fontSize: 16, color: '#8B5CF6', fontWeight: 'bold',
    position: 'absolute', right: 4, top: 2,
  },
  planetsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  planetInChart: { fontSize: 9, color: '#4B5563', marginRight: 2, fontWeight: '600' },
  chartLegend: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 8 },

  // House rows
  houseRow: {
    flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  houseNumberBox: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3E8FF',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  houseNumberText: { fontSize: 16, fontWeight: 'bold', color: '#8B5CF6' },
  houseDetailsContainer: { flex: 1 },
  houseSign: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 2 },
  houseLord: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
  housePlanets: { fontSize: 13, color: '#8B5CF6', fontWeight: '500' },

  // Dasha
  currentDashaPlanet: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginTop: 4 },
  currentDashaDate: { fontSize: 13, color: '#E9D5FF', marginTop: 2 },
  dashaDivider: { height: 1, backgroundColor: '#A78BFA', marginVertical: 12 },
  dashaRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    paddingHorizontal: 12, marginVertical: 4, borderRadius: 10, backgroundColor: '#F9FAFB',
  },
  currentDashaRow: { backgroundColor: '#8B5CF6' },
  dashaPlanetBox: {
    width: 70, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8,
    backgroundColor: '#F3E8FF', marginRight: 12, alignItems: 'center',
  },
  dashaPlanetText: { fontSize: 13, fontWeight: 'bold', color: '#8B5CF6' },
  dashaDetailsContainer: { flex: 1 },
  dashaDate: { fontSize: 13, color: '#374151', fontWeight: '500' },
  dashaDuration: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  currentBadge: {
    backgroundColor: '#FCD34D', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  currentBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#78350F' },

  // Transits
  transitRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  transitPlanet: { fontSize: 15, fontWeight: '600', color: '#374151', width: 90 },
  retrogradeText: { color: '#EF4444', fontSize: 13 },
  transitDetails: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  transitSign: { fontSize: 14, color: '#8B5CF6', fontWeight: '500' },
  transitDegree: { fontSize: 12, color: '#6B7280' },
  transitNakshatra: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  sadeSatiStatus: { fontSize: 16, fontWeight: 'bold', color: '#92400E' },

  // Yogas
  yogaCard: {
    borderLeftWidth: 4, paddingLeft: 12, paddingVertical: 10, marginBottom: 10,
    backgroundColor: '#F9FAFB', borderRadius: 8,
  },
  yogaHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
  },
  yogaName: { fontSize: 15, fontWeight: 'bold', color: '#374151' },
  yogaBadge: {
    fontSize: 11, fontWeight: 'bold', color: '#FFFFFF', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 10, overflow: 'hidden',
  },
  yogaDescription: { fontSize: 13, color: '#6B7280', lineHeight: 19 },
  sourceNote: {
    fontSize: 11, color: '#6B7280', fontStyle: 'italic',
    marginBottom: 10, lineHeight: 16,
  },
  meaningBox: {
    marginTop: 8, padding: 10, backgroundColor: '#F0FDF4',
    borderRadius: 6, borderLeftWidth: 3, borderLeftColor: '#10B981',
  },
  meaningLabel: {
    fontSize: 11, fontWeight: '700', color: '#047857', marginBottom: 3,
  },
  meaningText: {
    fontSize: 12, color: '#065F46', lineHeight: 17,
  },
  sourceChip: {
    marginTop: 6, fontSize: 10, color: '#9CA3AF',
    alignSelf: 'flex-start',
  },

  // Planets
  planetHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  planetNameBig: { fontSize: 20, fontWeight: 'bold', color: '#8B5CF6' },
  strengthBadge: {
    backgroundColor: '#F3E8FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  strengthText: { fontSize: 11, fontWeight: '600', color: '#8B5CF6' },
  planetInfoGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12,
  },
  planetInfoItem: {
    width: '47%', padding: 8, backgroundColor: '#F9FAFB', borderRadius: 8,
  },
  planetInfoLabel: { fontSize: 11, color: '#6B7280', marginBottom: 2 },
  planetInfoValue: { fontSize: 14, fontWeight: '600', color: '#374151' },
  planetAnalysisText: {
    fontSize: 13, color: '#4B5563', lineHeight: 20, marginTop: 6,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },

  // Predictions
  predictionHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
  },
  predictionHouseBox: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#8B5CF6',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  predictionHouseNum: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  predictionHouseName: { fontSize: 15, fontWeight: 'bold', color: '#374151' },
  predictionSignification: { fontSize: 12, color: '#6B7280', marginTop: 2, fontStyle: 'italic' },
  predictionText: { fontSize: 14, color: '#4B5563', lineHeight: 22 },

  // Shlokas
  shlokaCard: {
    backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 16,
    borderLeftWidth: 4, borderLeftColor: '#8B5CF6',
  },
  shlokaHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  shlokaTopic: {
    backgroundColor: '#F3E8FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  shlokaTopicText: { fontSize: 11, fontWeight: '700', color: '#8B5CF6', textTransform: 'uppercase' },
  shlokaNumber: { fontSize: 12, color: '#6B7280', fontStyle: 'italic' },
  shlokaLabel: {
    fontSize: 12, fontWeight: '700', color: '#8B5CF6', marginTop: 10, marginBottom: 4,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  shlokaSanskrit: {
    fontSize: 16, color: '#1F2937', lineHeight: 26, fontWeight: '500',
    backgroundColor: '#FEF3C7', padding: 10, borderRadius: 8,
  },
  shlokaText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  shlokaSource: {
    fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', marginTop: 12,
    textAlign: 'right',
  },

  // Daily
  predictionRow: {
    flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  dailyAreaLabel: {
    fontSize: 13, fontWeight: '700', color: '#8B5CF6',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  dailyAreaText: { fontSize: 14, color: '#374151', lineHeight: 20 },

  // Remedies
  remedyCard: {
    backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 16,
    borderLeftWidth: 4, borderLeftColor: '#F59E0B',
  },
  remedyHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  remedyPlanetName: { fontSize: 20, fontWeight: 'bold', color: '#8B5CF6' },
  remedyBadge: {
    backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  remedyBadgeText: { fontSize: 11, fontWeight: '600', color: '#92400E' },
  remedyReason: {
    fontSize: 13, color: '#92400E', backgroundColor: '#FEF3C7',
    padding: 10, borderRadius: 8, marginBottom: 12, lineHeight: 19,
  },
  remedyRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  remedyLabel: {
    fontSize: 11, color: '#6B7280', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2,
  },
  remedyValue: { fontSize: 14, color: '#374151', fontWeight: '500', lineHeight: 20 },

  // Muhurat
  muhurtCard: {
    backgroundColor: '#FFFFFF', padding: 12, borderRadius: 10, marginBottom: 8,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  muhurtHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
  },
  muhurtName: { fontSize: 15, fontWeight: 'bold' },
  muhurtTime: { fontSize: 13, fontWeight: '700' },
  muhurtDesc: { fontSize: 12, color: '#6B7280', lineHeight: 18 },

  // v7.2 — Ayanamsa selector (sidereal zero-point system)
  ayanamsaContainer: { marginBottom: 20 },
  ayanamsaLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8,
  },
  ayanamsaScroll: {
    flexDirection: 'row',
  },
  ayanamsaScrollContent: {
    flexDirection: 'row', gap: 8, paddingRight: 8,
  },
  ayanamsaChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB',
    minHeight: 36, justifyContent: 'center',
  },
  ayanamsaChipActive: { backgroundColor: '#4338CA', borderColor: '#4338CA' },
  ayanamsaChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  ayanamsaChipTextActive: { color: '#FFFFFF' },
  ayanamsaDesc: {
    fontSize: 11, color: '#9CA3AF', marginTop: 6, marginLeft: 4, fontStyle: 'italic',
  },
});
