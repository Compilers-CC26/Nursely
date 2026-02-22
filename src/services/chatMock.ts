/**
 * Chat Mock Service
 *
 * Simulates an agentic AI assistant for nurses.
 * -----------------------------------------------
 * ⚠️  Replace chatMock with real LLM API call:
 *     Swap generateResponse() with a call to OpenAI, Anthropic,
 *     or your internal clinical LLM endpoint. Pass the patient
 *     context and conversation history for contextual answers.
 *     Real citations should come from RAG retrieval or tool-use.
 * -----------------------------------------------
 */

import type { Patient } from "@/types";
import { askSnowflakeQuestion } from "@/services/snowflakeMock";

export interface Citation {
  /** Short label shown on the chip, e.g. "CMS SEP-1 Bundle" */
  title: string;
  /** Source organization or guideline name */
  source: string;
  /** URL (or internal doc link) — set to "#" for mock */
  url: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

interface TopicResponse {
  content: string;
  citations: Citation[];
}

const CLINICAL_RESPONSES: Record<string, TopicResponse[]> = {
  sepsis: [
    {
      content:
        "**Sepsis Bundle (SEP-1) Key Steps:**\n1. Measure lactate level\n2. Obtain blood cultures before antibiotics\n3. Administer broad-spectrum antibiotics within 1 hour\n4. Administer 30 mL/kg crystalloid for hypotension or lactate ≥ 4\n5. Apply vasopressors if hypotensive after fluid resuscitation\n6. Remeasure lactate if initial lactate > 2 mmol/L\n\nFor this patient, verify all bundle elements are documented in the EHR.",
      citations: [
        {
          title: "SEP-1 Early Management Bundle",
          source: "CMS / The Joint Commission",
          url: "https://www.jointcommission.org/measurement/measures/sepsis/",
        },
        {
          title: "Surviving Sepsis Campaign 2021",
          source: "Society of Critical Care Medicine",
          url: "https://www.sccm.org/SurvivingSepsisCampaign/Guidelines",
        },
        {
          title: "Sepsis Core Measure",
          source: "CMS Quality Measures",
          url: "https://qualitynet.cms.gov/inpatient/measures/sep",
        },
      ],
    },
  ],
  medication: [
    {
      content:
        "I can help with medication questions. Here are common nursing considerations:\n\n• **Before administering**: Verify the 5 Rights (right patient, drug, dose, route, time)\n• **High-alert meds**: Double-check insulin, heparin, opioids, and vasoactive drips\n• **Drug interactions**: Always cross-reference with current med list in the MAR\n• **PRN documentation**: Document indication, assessment before/after\n\nWhat specific medication do you need information about?",
      citations: [
        {
          title: "High-Alert Medications in Acute Care",
          source: "ISMP (Institute for Safe Medication Practices)",
          url: "https://www.ismp.org/recommendations/high-alert-medications-acute-list",
        },
        {
          title: "Medication Administration Safety",
          source: "ANA (American Nurses Association)",
          url: "https://www.nursingworld.org/practice-policy/nursing-excellence/official-position-statements/",
        },
      ],
    },
  ],
  vitals: [
    {
      content:
        "**Quick Vitals Reference — When to Escalate:**\n\n| Parameter | Concern Range |\n|-----------|---------------|\n| HR | < 50 or > 120 |\n| SBP | < 90 or > 180 |\n| RR | < 10 or > 28 |\n| Temp | > 101.3°F or < 96°F |\n| SpO2 | < 92% on room air |\n\nIf 2+ parameters are abnormal, consider activating the **Rapid Response Team**. Always trend vitals — a single reading matters less than the trajectory.",
      citations: [
        {
          title: "Modified Early Warning Score (MEWS)",
          source: "BMJ Best Practice",
          url: "https://bestpractice.bmj.com/topics/en-us/1207",
        },
        {
          title: "National Early Warning Score (NEWS2)",
          source: "Royal College of Physicians",
          url: "https://www.rcplondon.ac.uk/projects/outputs/national-early-warning-score-news-2",
        },
        {
          title: "Rapid Response Systems",
          source: "Agency for Healthcare Research and Quality (AHRQ)",
          url: "https://www.ahrq.gov/patient-safety/settings/hospital/rrr/index.html",
        },
      ],
    },
  ],
  labs: [
    {
      content:
        "**Common Critical Lab Values to Report Immediately:**\n\n• Potassium: < 3.0 or > 6.0 mEq/L\n• Sodium: < 120 or > 160 mEq/L\n• Glucose: < 50 or > 500 mg/dL\n• Troponin: Any elevation above normal\n• Lactate: > 2.0 mmol/L\n• Hemoglobin: < 7.0 g/dL\n• INR: > 4.0 (or any critical value per your lab)\n\nAlways call the provider for critical values and document the time of notification.",
      citations: [
        {
          title: "Critical / Panic Lab Values",
          source: "CLSI (Clinical and Laboratory Standards Institute)",
          url: "https://clsi.org/",
        },
        {
          title: "Laboratory Critical Values",
          source: "College of American Pathologists (CAP)",
          url: "https://www.cap.org/",
        },
      ],
    },
  ],
  fall: [
    {
      content:
        "**Fall Prevention Protocol:**\n\n1. Assess fall risk using Morse Fall Scale on admission and every shift\n2. For high-risk patients:\n   - Yellow wristband and door sign\n   - Bed in lowest position, wheels locked\n   - Call light within reach\n   - Non-skid footwear\n   - Toileting schedule every 2 hours\n   - Consider 1:1 sitter or bed alarm\n3. Educate patient and family on fall prevention\n4. Document all interventions in the care plan",
      citations: [
        {
          title: "Morse Fall Scale",
          source: "Journal of Nursing Administration (1989)",
          url: "https://pubmed.ncbi.nlm.nih.gov/2787768/",
        },
        {
          title: "Preventing Falls in Hospitals",
          source: "AHRQ Patient Safety Network",
          url: "https://www.ahrq.gov/patient-safety/settings/hospital/fall-prevention/toolkit/index.html",
        },
        {
          title: "Fall Prevention Guidelines",
          source: "The Joint Commission",
          url: "https://www.jointcommission.org/resources/patient-safety-topics/falls/",
        },
      ],
    },
  ],
  pain: [
    {
      content:
        "**Pain Assessment & Management:**\n\n• Use appropriate scale: NRS (0-10) for verbal patients, FLACC or CPOT for non-verbal\n• Assess pain with every vital sign check\n• Document: Location, quality, intensity, duration, aggravating/alleviating factors\n• Non-pharmacologic options first when appropriate: repositioning, ice/heat, distraction, relaxation\n• For PRN meds: reassess 30 min after IV, 60 min after PO\n• Set realistic pain goals with the patient\n\nWhat specific pain concern do you have?",
      citations: [
        {
          title: "Pain Management Nursing Standards",
          source: "American Society for Pain Management Nursing (ASPMN)",
          url: "https://www.aspmn.org/",
        },
        {
          title: "CPOT: Critical-Care Pain Observation Tool",
          source: "American Journal of Critical Care (2006)",
          url: "https://pubmed.ncbi.nlm.nih.gov/16823021/",
        },
        {
          title: "WHO Analgesic Ladder",
          source: "World Health Organization",
          url: "https://www.who.int/cancer/palliative/painladder/en/",
        },
      ],
    },
  ],
  sbar: [
    {
      content:
        "**SBAR Communication Framework:**\n\n**S — Situation**: State who you are, which patient, and what's happening right now\n**B — Background**: Relevant history, admission diagnosis, pertinent recent events\n**A — Assessment**: Your clinical impression — what you think is going on\n**R — Recommendation**: What you need from the provider — specific orders or actions\n\n💡 **Tip**: Write your SBAR before calling. Lead with urgency level. Have the chart open during the call.\n\nI can generate an SBAR for any selected patient — just click one in the table.",
      citations: [
        {
          title: "SBAR Communication Technique",
          source: "Institute for Healthcare Improvement (IHI)",
          url: "https://www.ihi.org/resources/Pages/Tools/SBARToolkit.aspx",
        },
        {
          title: "TeamSTEPPS Communication",
          source: "AHRQ",
          url: "https://www.ahrq.gov/teamstepps/index.html",
        },
      ],
    },
  ],
  code: [
    {
      content:
        "**Code Blue Response Checklist:**\n\n1. Call code / activate emergency response\n2. Begin high-quality CPR (push hard, push fast, 100-120/min)\n3. Attach AED/defibrillator as soon as available\n4. Establish IV access\n5. Administer epinephrine 1mg IV q3-5min\n6. Identify and treat reversible causes (H's and T's)\n7. Document — assign a recorder role\n\n**H's**: Hypovolemia, Hypoxia, H+ (acidosis), Hypo/Hyperkalemia, Hypothermia\n**T's**: Tension pneumothorax, Tamponade, Toxins, Thrombosis (PE/MI)",
      citations: [
        {
          title: "ACLS Guidelines 2020",
          source: "American Heart Association (AHA)",
          url: "https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines",
        },
        {
          title: "BLS/ACLS Algorithm Cards",
          source: "AHA",
          url: "https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/algorithms",
        },
      ],
    },
  ],
  wound: [
    {
      content:
        "**Wound & Pressure Injury Prevention / Management:**\n\n" +
        "**Prevention (Stage 0):**\n" +
        "• Reposition immobile patients every 2 hours (or per Braden score-based schedule)\n" +
        "• Use pressure-redistribution mattress/overlay for Braden score ≤ 18\n" +
        "• Maintain skin clean and dry; apply barrier cream to incontinent patients\n" +
        "• Nutritional consult for albumin < 3.5 g/dL or unintentional weight loss\n\n" +
        "**Wound Assessment (each dressing change):**\n" +
        "• Document: size (L×W×D cm), stage/category, exudate type/amount, periwound skin, odor, granulation vs. necrotic tissue\n" +
        "• Use TIME framework: Tissue, Infection/inflammation, Moisture, Edge\n\n" +
        "**Staging Reference (NPIAP 2019):**\n" +
        "Stage 1: Non-blanchable erythema | Stage 2: Partial-thickness skin loss | Stage 3: Full-thickness skin loss | Stage 4: Full-thickness tissue loss | Unstageable: Obscured depth | Deep Tissue: Persistent non-blanchable deep red/maroon",
      citations: [
        {
          title:
            "Pressure Injury Prevention & Treatment — Clinical Practice Guideline 2019",
          source: "National Pressure Injury Advisory Panel (NPIAP)",
          url: "https://npiap.com/page/ClinicalGuidelines",
        },
        {
          title: "Wound, Ostomy & Continence Nursing Standards of Practice",
          source: "Wound, Ostomy and Continence Nurses Society (WOCN)",
          url: "https://www.wocn.org/page/publications",
        },
        {
          title: "Preventing Pressure Ulcers in Hospitals",
          source: "AHRQ Patient Safety Network",
          url: "https://www.ahrq.gov/patient-safety/settings/hospital/resource/pressureulcer/tool/index.html",
        },
      ],
    },
  ],
  vte: [
    {
      content:
        "**VTE (DVT/PE) Prophylaxis & Assessment:**\n\n" +
        "**Risk Assessment:**\n" +
        "• Use Caprini or Padua score on admission and after any major clinical change\n" +
        "• Immobility, prior VTE, malignancy, hypercoagulable state = high risk\n\n" +
        "**Prophylaxis — confirm orders are in place:**\n" +
        "• Pharmacologic: Enoxaparin, heparin, or fondaparinux (confirm renal function first)\n" +
        "• Mechanical: Sequential compression devices (SCDs) — verify they are applied and powered on for ALL non-ambulatory patients\n" +
        "• Ambulate early; document ambulation frequency\n\n" +
        "**Signs of DVT / PE to escalate:**\n" +
        "• DVT: Unilateral calf/thigh swelling, erythema, warmth, Homans' sign (low sensitivity)\n" +
        "• PE: Sudden dyspnea, pleuritic chest pain, tachycardia, hypoxia, hemoptysis\n" +
        "• Notify provider immediately; hold mechanical prophylaxis if active DVT suspected",
      citations: [
        {
          title:
            "VTE Prevention in Hospitalized Patients — CHEST Guideline 2012 (reaffirmed 2022)",
          source: "American College of Chest Physicians (ACCP/CHEST)",
          url: "https://journal.chestnet.org/article/S0012-3692(15)37236-5/fulltext",
        },
        {
          title: "Prevention of VTE in Nonorthopedic Surgical Patients",
          source: "AHRQ Patient Safety",
          url: "https://www.ahrq.gov/patient-safety/settings/hospital/index.html",
        },
        {
          title: "Deep Vein Thrombosis (Patient Education)",
          source: "American Heart Association (AHA)",
          url: "https://www.heart.org/en/health-topics/venous-thromboembolism",
        },
      ],
    },
  ],
  glucose: [
    {
      content:
        "**Glycemic Management in Hospitalized Patients:**\n\n" +
        "**Target Glucose Ranges (ADA 2024):**\n" +
        "• Non-ICU: 140–180 mg/dL (more stringent 110–140 mg/dL if appropriate and achievable)\n" +
        "• ICU / critically ill: 140–180 mg/dL\n" +
        "• Hypoglycemia (< 70 mg/dL): Treat immediately per protocol; notify provider if < 54 mg/dL\n\n" +
        "**Nursing Actions:**\n" +
        "• Check POC glucose per orders (typically AC&HS or q4–6h for NPO/continuous feeds)\n" +
        "• Insulin administration: Always double-check dose with a second nurse for > 10 units\n" +
        "• Hypoglycemia treatment (conscious patient): 15–20 g fast-acting carb → recheck in 15 min (Rule of 15)\n" +
        "• Hyperglycemia > 300 mg/dL: Assess for DKA/HHS; notify provider\n" +
        "• Document: Pre-meal glucose, insulin given, patient response, site rotation",
      citations: [
        {
          title:
            "Standards of Medical Care in Diabetes 2024 — Section 16: Diabetes Care in the Hospital",
          source: "American Diabetes Association (ADA)",
          url: "https://diabetesjournals.org/care/article/47/Supplement_1/S295/153952",
        },
        {
          title: "AACE/ADA Consensus Statement on Inpatient Glycemic Control",
          source: "American Association of Clinical Endocrinologists / ADA",
          url: "https://www.endocrine.org/clinical-practice-guidelines",
        },
        {
          title: "Insulin Safety in the Hospital",
          source: "ISMP (Institute for Safe Medication Practices)",
          url: "https://www.ismp.org/",
        },
      ],
    },
  ],
  respiratory: [
    {
      content:
        "**Respiratory Assessment & Airway Management:**\n\n" +
        "**Routine Assessment:**\n" +
        "• RR, depth, pattern, accessory muscle use, pursed-lip breathing, nasal flaring\n" +
        "• Auscultate: crackles (fluid/consolidation), wheeze (bronchospasm), stridor (upper obstruction), diminished (effusion/atelectasis)\n" +
        "• SpO2 target: ≥ 94% for most patients; 88–92% for COPD/hypercapnic risk\n\n" +
        "**Oxygen Escalation Pathway:**\n" +
        "NC 1–6 L/min → Simple mask 6–10 L/min → NRB 10–15 L/min → HFNC → NIPPV (BiPAP/CPAP) → Intubation\n\n" +
        "**VAP Bundle (ventilated patients):**\n" +
        "• HOB 30–45°, daily sedation vacation, daily SBT assessment, oral care q4h with chlorhexidine, PUD/DVT prophylaxis, cuff pressure 20–30 cmH₂O\n\n" +
        "**Escalate Immediately If:**\n" +
        "• SpO2 < 90% on current O₂, RR > 30, use of accessory muscles, cyanosis, altered mental status with respiratory distress",
      citations: [
        {
          title:
            "BTS Guideline for Oxygen Use in Adults in Healthcare and Emergency Settings 2017",
          source: "British Thoracic Society (BTS)",
          url: "https://www.brit-thoracic.org.uk/quality-improvement/guidelines/oxygen/",
        },
        {
          title: "Strategies to Prevent VAP — SHEA/IDSA Compendium 2022",
          source: "Society for Healthcare Epidemiology of America / IDSA",
          url: "https://shea-online.org/index.php/practice-resources/priority-topics/vap",
        },
        {
          title: "ATS/ERS/ESICM/SCCM/SRLF Statement: Noninvasive Ventilation",
          source: "American Thoracic Society (ATS)",
          url: "https://www.thoracic.org/statements/",
        },
      ],
    },
  ],
  cardiac: [
    {
      content:
        "**Cardiac Monitoring & Heart Failure Management:**\n\n" +
        "**Telemetry Alarm Response:**\n" +
        "• Asystole / VFib / pulseless VTach → Code Blue immediately\n" +
        "• SVT with hemodynamic instability → rapid response + 12-lead ECG\n" +
        "• New AFib: rate vs. rhythm control per provider; assess for anticoagulation order\n" +
        "• 3rd degree AV block, new LBBB → stat provider notification\n\n" +
        "**Heart Failure Monitoring (key nursing actions):**\n" +
        "• Daily weight (same time, same scale, same clothing) — notify MD if > 2 lb/day or 5 lb/week gain\n" +
        "• Strict I&O; fluid restriction per orders (typically 1.5–2 L/day in decompensated HF)\n" +
        "• Assess JVD, S3/S4, peripheral edema, crackles at baseline and each shift\n" +
        "• Hold ACE/ARB/ARNI if SBP < 90 or creatinine rise > 30% — notify provider\n" +
        "• Educate: daily weights, low-sodium diet (< 2 g/day), medication adherence, activity limits",
      citations: [
        {
          title:
            "2022 AHA/ACC/HFSA Guideline for the Management of Heart Failure",
          source: "American Heart Association / American College of Cardiology",
          url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000001063",
        },
        {
          title: "ECG Rhythm Interpretation — Nursing Reference",
          source: "American Association of Critical-Care Nurses (AACN)",
          url: "https://www.aacn.org/clinical-resources/practice-alerts",
        },
        {
          title: "Telemetry Alarm Management in Adult Patients",
          source: "The Joint Commission — Sentinel Event Alert 50",
          url: "https://www.jointcommission.org/resources/sentinel-event/sentinel-event-alert-newsletters/sentinel-event-alert-50-medical-device-alarm-safety-in-hospitals/",
        },
      ],
    },
  ],
  renal: [
    {
      content:
        "**Acute Kidney Injury (AKI) — Nursing Management:**\n\n" +
        "**KDIGO AKI Staging:**\n" +
        "• Stage 1: Creatinine × 1.5–1.9× baseline, or ↑ ≥ 0.3 mg/dL, or UO < 0.5 mL/kg/h × 6–12h\n" +
        "• Stage 2: Creatinine × 2.0–2.9× baseline, or UO < 0.5 mL/kg/h × 12h\n" +
        "• Stage 3: Creatinine × 3×, or ≥ 4.0 mg/dL, or UO < 0.3 mL/kg/h × 24h, or anuria × 12h\n\n" +
        "**Nursing Actions:**\n" +
        "• Hourly urine output if Foley in place — notify if < 30 mL/h × 2h\n" +
        "• Hold nephrotoxic agents (NSAIDs, aminoglycosides, IV contrast) — notify provider\n" +
        "• Monitor K⁺, BUN, creatinine, acid-base\n" +
        "• Fluid challenge vs. restriction per provider orders — avoid both overload and hypovolemia\n" +
        "• If K⁺ > 6.0: ECG, emergent provider notification, prepare for calcium gluconate/kayexalate/insulin-dextrose per orders",
      citations: [
        {
          title:
            "KDIGO Clinical Practice Guideline for Acute Kidney Injury 2012",
          source: "Kidney Disease: Improving Global Outcomes (KDIGO)",
          url: "https://kdigo.org/guidelines/acute-kidney-injury/",
        },
        {
          title: "AKI & Critical Care Nephrology",
          source: "American Society of Nephrology (ASN)",
          url: "https://www.asn-online.org/education/training/fellows/curriculum/",
        },
      ],
    },
  ],
  delirium: [
    {
      content:
        "**Delirium Assessment & Non-Pharmacologic Management:**\n\n" +
        "**Screen Every Shift (use validated tool):**\n" +
        "• CAM (Confusion Assessment Method): Acute onset + fluctuating course + inattention + disorganized thinking or altered LOC = Delirium positive\n" +
        "• CAM-ICU for mechanically ventilated patients\n" +
        "• RASS (Richmond Agitation-Sedation Scale) for sedation level\n\n" +
        "**ABCDEF Bundle (ICU/acute care):**\n" +
        "• **A** — Assess/prevent/manage pain (CPOT/NRS)\n" +
        "• **B** — Both SAT & SBT daily\n" +
        "• **C** — Choice of sedation (minimize benzodiazepines; prefer propofol/dexmedetomidine)\n" +
        "• **D** — Delirium monitoring & management (re-orient q4h, clocks, calendars, family presence)\n" +
        "• **E** — Early mobility & exercise\n" +
        "• **F** — Family engagement\n\n" +
        "**Avoid high-risk medications:** Review Beers Criteria — anticholinergics, benzodiazepines, antihistamines (diphenhydramine), meperidine, antipsychotics in dementia patients",
      citations: [
        {
          title:
            "Clinical Practice Guidelines for the Prevention and Management of Pain, Agitation/Sedation, Delirium, Immobility, and Sleep Disruption in Adult ICU Patients (PADIS 2018)",
          source: "Society of Critical Care Medicine (SCCM)",
          url: "https://www.sccm.org/Clinical-Resources/Guidelines/Guidelines/Guidelines-for-the-Prevention-and-Management-of-Pa",
        },
        {
          title: "American Geriatrics Society 2023 Updated Beers Criteria",
          source: "American Geriatrics Society (AGS)",
          url: "https://agsjournals.onlinelibrary.wiley.com/doi/10.1111/jgs.18372",
        },
        {
          title: "Confusion Assessment Method (CAM) Tool",
          source: "Hospital Elder Life Program (HELP), Sharon Inouye MD",
          url: "https://www.hospitalelderlifeprogram.org/delirium-instruments/cam/",
        },
      ],
    },
  ],
  infection: [
    {
      content:
        "**Infection Control & Hand Hygiene:**\n\n" +
        "**WHO Five Moments for Hand Hygiene:**\n" +
        "1. Before touching a patient\n" +
        "2. Before a clean/aseptic procedure\n" +
        "3. After body fluid exposure risk\n" +
        "4. After touching a patient\n" +
        "5. After touching patient surroundings\n\n" +
        "**Transmission-Based Precautions:**\n" +
        "• **Contact** (MRSA, C. diff, VRE, norovirus): Gown + gloves on room entry; C. diff → soap & water only (alcohol ineffective)\n" +
        "• **Droplet** (influenza, COVID, RSV, pertussis): Surgical mask within 3 feet; patient wears mask during transport\n" +
        "• **Airborne** (TB, measles, varicella, COVID aerosol-generating): N95 or PAPR; negative-pressure room; door closed\n\n" +
        "**CLABSI / CAUTI Prevention:**\n" +
        "• CLABSI: Daily necessity review, hub disinfection ('scrub the hub' ≥ 15 sec), dressing integrity, site inspection\n" +
        "• CAUTI: Daily catheter necessity review; remove asap; maintain closed system; bag below bladder; perineal care",
      citations: [
        {
          title: "CDC Hand Hygiene in Healthcare Settings",
          source: "Centers for Disease Control and Prevention (CDC)",
          url: "https://www.cdc.gov/handhygiene/",
        },
        {
          title:
            "2007 Guideline for Isolation Precautions in Healthcare Facilities",
          source: "CDC / HICPAC",
          url: "https://www.cdc.gov/infectioncontrol/guidelines/isolation/",
        },
        {
          title: "CLABSI & CAUTI Prevention Toolkit",
          source: "AHRQ Patient Safety",
          url: "https://www.ahrq.gov/hai/clabsi-tools/index.html",
        },
      ],
    },
  ],
  stroke: [
    {
      content:
        "**Stroke — Recognition, Response & Post-Stroke Nursing Care:**\n\n" +
        "**FAST Recognition:**\n" +
        "• **F**ace drooping • **A**rm weakness • **S**peech difficulty • **T**ime to call code stroke\n" +
        "• Last known well time is critical — document precisely\n\n" +
        "**Acute Care (first 24h):**\n" +
        "• Maintain SpO2 ≥ 94%; O2 only if hypoxic\n" +
        "• BP management: Do NOT aggressively lower unless > 220/120 (ischemic, no tPA) or > 180/105 (post-tPA)\n" +
        "• Swallow screen before any PO — NPO until passed; aspiration precautions\n" +
        "• HOB flat (or 0–15°) for 24h if ischemic/no ICP concerns → improves perfusion\n" +
        "• Glucose target 140–180 mg/dL; avoid hyperthermia (treat temp > 37.5°C)\n\n" +
        "**Ongoing Monitoring:**\n" +
        "• Neuro checks q1–4h (NIHSS, GCS, pupil response, focal deficits)\n" +
        "• Hemorrhagic conversion: New headache, BP spike, declining neuro status — stat CT, notify provider",
      citations: [
        {
          title:
            "2019 AHA/ASA Guidelines for the Early Management of Acute Ischemic Stroke",
          source: "American Heart Association / American Stroke Association",
          url: "https://www.ahajournals.org/doi/10.1161/STR.0000000000000211",
        },
        {
          title: "Nursing Management of Stroke",
          source: "American Association of Neuroscience Nurses (AANN)",
          url: "https://www.aann.org/publications/cpg",
        },
      ],
    },
  ],
  drug_interaction: [
    {
      content:
        "**Drug Interaction Check — Nursing Responsibilities:**\n\n⚠️ **Never rely on memory alone.** Always verify using a clinical reference before co-administering.\n\n**Key high-risk combinations:**\n• **Benzodiazepines + CNS depressants** (e.g., clonazepam + opioids, alcohol, sedative-hypnotics): FDA **black box warning** — additive CNS/respiratory depression, risk of death\n• **Acetaminophen**: safe max is **4 g/day** total — check for hidden acetaminophen in combination products (Percocet, Vicodin, NyQuil, etc.). Reduce to **2 g/day** in liver disease or ETOH use\n• **Anticoagulants + NSAIDs/aspirin**: increased bleeding risk\n• **QT-prolonging agents** (fluoroquinolones, antipsychotics, methadone): additive arrhythmia risk\n\n**Your action steps:**\n1. Cross-reference the **full MAR** against an interaction checker (Lexicomp or Micromedex)\n2. Contact the **pharmacist** for any CNS depressant combination or polypharmacy concern\n3. Document your interaction review in the nursing note\n4. Hold and notify the provider if a contraindicated combination is identified",
      citations: [
        {
          title:
            "FDA Black Box Warning: Opioids + Benzodiazepines / CNS Depressants",
          source: "U.S. Food & Drug Administration (FDA)",
          url: "https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-fda-warns-about-serious-risks-and-death-when-combining-opioid-pain-or",
        },
        {
          title: "Drug Interaction Checker (Lexicomp)",
          source: "UpToDate / Lexicomp",
          url: "https://www.uptodate.com/drug-interactions/",
        },
        {
          title: "High-Alert Medications in Acute Care Settings",
          source: "ISMP (Institute for Safe Medication Practices)",
          url: "https://www.ismp.org/recommendations/high-alert-medications-acute-list",
        },
        {
          title: "Acetaminophen Hepatotoxicity and Safe Dosing",
          source: "FDA / Acetaminophen Awareness Coalition",
          url: "https://www.fda.gov/drugs/medication-health-fraud/acetaminophen-information",
        },
      ],
    },
  ],
};

const PATIENT_CONTEXT_RESPONSES: TopicResponse[] = [
  {
    content:
      "Based on this patient's current presentation, here are my recommendations:\n\n1. **Priority assessments**: Focus on trending vitals every 1-2 hours given the acuity\n2. **Lab monitoring**: Flag any critical values for immediate provider notification\n3. **Documentation**: Ensure all interventions and assessments are charted in real-time\n4. **Care coordination**: Consider rounding with the interdisciplinary team\n\nWould you like me to go deeper into any of these areas?",
    citations: [
      {
        title: "Patient EHR Record",
        source: "Local FHIR Data",
        url: "#patient-ehr",
      },
      {
        title: "Clinical Decision Support",
        source: "Snowflake Analytics",
        url: "#snowflake-analytics",
      },
      {
        title: "Nursing Assessment Standards",
        source: "ANA Scope & Standards of Practice",
        url: "https://www.nursingworld.org/practice-policy/scope-of-practice/",
      },
    ],
  },
  {
    content:
      "Looking at the patient's clinical picture:\n\n• Current medications appear appropriate for the diagnosis\n• Watch for potential drug interactions — review the MAR carefully\n• Ensure PRN medications have clear parameters documented\n• Verify all ordered labs are drawn on schedule\n\nIs there a specific aspect of this patient's care you'd like guidance on?",
    citations: [
      {
        title: "Patient EHR Record",
        source: "Local FHIR Data",
        url: "#patient-ehr",
      },
      {
        title: "Drug Interaction Checker",
        source: "Lexicomp / UpToDate",
        url: "https://www.uptodate.com/drug-interactions/",
      },
    ],
  },
];

const GENERAL_RESPONSES: TopicResponse[] = [
  {
    content:
      "I'm here to help with clinical questions, care protocols, medication guidance, and documentation support. Here are some things I can assist with:\n\n• **Patient assessments** — vitals interpretation, lab values, clinical changes\n• **Protocols** — sepsis bundles, fall prevention, pain management, code response\n• **Medications** — drug information, interactions, administration guidelines\n• **Documentation** — SBAR reports, nursing notes, care plan updates\n• **Escalation** — when and how to notify providers or rapid response\n\nJust ask your question and I'll provide evidence-based guidance!",
    citations: [],
  },
  {
    content:
      "That's a great question. Let me help you think through this:\n\n1. Start by reviewing the patient's most recent assessment\n2. Check for any new orders or changes in the plan of care\n3. Verify that all interventions are documented\n4. Consider if any notifications to the provider are needed\n\nCan you give me more details about what specific information you need?",
    citations: [
      {
        title: "Nursing Process Framework",
        source: "ANA (American Nurses Association)",
        url: "https://www.nursingworld.org/practice-policy/workforce/what-is-nursing/the-nursing-process/",
      },
    ],
  },
];

function matchTopic(message: string): string | null {
  const lower = message.toLowerCase();
  const topics: [string, string[]][] = [
    ["sepsis", ["sepsis", "septic", "infection", "lactate", "bundle"]],
    [
      "medication",
      [
        "medication",
        "medicine",
        "drug",
        "med",
        "dose",
        "dosage",
        "administer",
        "give",
        "mar",
        "high-alert",
        "high alert",
      ],
    ],
    [
      "vitals",
      [
        "vital",
        "blood pressure",
        "heart rate",
        "temperature",
        "oxygen",
        "spo2",
        "bp",
        "hr",
        "temp",
        "pulse",
        "respiratory rate",
      ],
    ],
    [
      "labs",
      [
        "lab",
        "blood work",
        "cbc",
        "bmp",
        "troponin",
        "potassium",
        "sodium",
        "glucose",
        "hemoglobin",
        "critical value",
        "creatinine",
        "wbc",
        "platelet",
        "inr",
        "coagulation",
      ],
    ],
    ["fall", ["fall", "falling", "slip", "balance", "morse", "bed alarm"]],
    [
      "pain",
      [
        "pain",
        "hurt",
        "discomfort",
        "analgesic",
        "opioid",
        "narcotic",
        "prn",
        "cpot",
        "flacc",
      ],
    ],
    [
      "sbar",
      [
        "sbar",
        "handoff",
        "report",
        "communicate",
        "situation background",
        "hand-off",
      ],
    ],
    [
      "code",
      [
        "code blue",
        "code",
        "arrest",
        "cpr",
        "resuscitation",
        "emergency",
        "acls",
        "bls",
        "aed",
        "defibrillat",
      ],
    ],
    [
      "wound",
      [
        "wound",
        "pressure injur",
        "pressure ulcer",
        "decubitus",
        "skin breakdown",
        "stage",
        "dressing",
        "braden",
        "tissue",
      ],
    ],
    [
      "vte",
      [
        "dvt",
        "pe ",
        "pulmonary embolism",
        "deep vein",
        "blood clot",
        "thrombosis",
        "vte",
        "anticoagulat",
        "scd",
        "sequential compress",
        "lovenox",
        "enoxaparin",
        "heparin",
      ],
    ],
    [
      "glucose",
      [
        "glucose",
        "blood sugar",
        "insulin",
        "hyperglycemia",
        "hypoglycemia",
        "diabetic",
        "diabetes",
        "a1c",
        "dka",
        "hhs",
        "glycemic",
      ],
    ],
    [
      "respiratory",
      [
        "breath",
        "respiratory",
        "lung",
        "pneumonia",
        "copd",
        "asthma",
        "wheez",
        "crackle",
        "oxygen therapy",
        "intubat",
        "ventilat",
        "bipap",
        "cpap",
        "hfnc",
        "vap",
        "airway",
        "nebulizer",
      ],
    ],
    [
      "cardiac",
      [
        "cardiac",
        "heart failure",
        "chf",
        "afib",
        "atrial fibril",
        "ekg",
        "ecg",
        "telemetry",
        "rhythm",
        "pacemaker",
        "chest pain",
        "mi ",
        "myocardial",
        "ejection fraction",
        "bpm",
      ],
    ],
    [
      "renal",
      [
        "renal",
        "kidney",
        "aki",
        "acute kidney",
        "creatinine",
        "bun",
        "urine output",
        "foley",
        "oliguria",
        "anuria",
        "dialysis",
        "urine",
      ],
    ],
    [
      "delirium",
      [
        "delirium",
        "confused",
        "confusion",
        "agitat",
        "restless",
        "altered mental",
        "orientation",
        "cam",
        "rass",
        "sedation",
        "sundown",
      ],
    ],
    [
      "infection",
      [
        "infection control",
        "precaution",
        "isolation",
        "mrsa",
        "vre",
        "c. diff",
        "clostridium",
        "hand hygiene",
        "ppe",
        "gown",
        "gloves",
        "clabsi",
        "cauti",
        "central line",
        "catheter",
      ],
    ],
    [
      "stroke",
      [
        "stroke",
        "tia",
        "neuro",
        "neurologic",
        "nihss",
        "facial droop",
        "arm weakness",
        "speech",
        "cva",
        "cerebral",
        "aphasia",
        "fast ",
      ],
    ],
    [
      "drug_interaction",
      [
        "interact",
        "interaction",
        "go with",
        "goes with",
        "go together",
        "goes together",
        "combine",
        "combined with",
        "compatible",
        "safe with",
        "together with",
        "contraindicated",
        "contraindication",
        "drug-drug",
        "polypharmacy",
        "can i give",
        "can you give",
        "mix with",
        "mixing",
        "acetaminophen",
        "benzodiazepine",
        "opioid combination",
        "drug interaction",
      ],
    ],
  ];

  for (const [topic, keywords] of topics) {
    if (keywords.some((kw) => lower.includes(kw))) return topic;
  }
  return null;
}

/**
 * Return authoritative citations for a given message topic.
 * Used to supplement Snowflake answers with professional sources.
 */
function getTopicCitations(message: string): Citation[] {
  const topic = matchTopic(message);
  if (!topic || !CLINICAL_RESPONSES[topic]) return [];
  return CLINICAL_RESPONSES[topic][0].citations;
}

let msgCounter = 0;

export interface FilterCommand {
  type: "search" | "risk" | "flag" | "clear";
  text?: string;
  riskMin?: number;
  riskMax?: number;
  flag?: "antibiotics" | "fall-risk" | "critical-labs" | "high-risk";
  label: string;
}

export interface ChatResponse {
  content: string;
  citations: Citation[];
  filterCommand?: FilterCommand;
}

/**
 * Extract the best available diagnosis label for a patient.
 * Falls back to the first condition name in summary when the diagnosis
 * field is null/Unknown (common when loading from old Snowflake data).
 */
function getEffectiveDiagnosis(p: Patient): string | null {
  const bad = new Set([
    "",
    "unknown",
    "no active conditions",
    "undocumented",
    "not documented",
  ]);
  const dx = (p.diagnosis ?? "").trim();
  if (dx && !bad.has(dx.toLowerCase())) return dx;

  // Try to parse first condition from summary: "Active conditions: Cond1; Cond2..."
  if (p.summary) {
    const match = p.summary.match(/Active conditions:\s*([^;\n]+)/i);
    if (match) {
      const extracted = match[1].trim();
      if (
        extracted &&
        !bad.has(extracted.toLowerCase()) &&
        extracted !== "Unknown condition"
      ) {
        return extracted;
      }
    }
  }
  return null;
}

/**
 * Scan a message for any patient name from the live census.
 * Checks full name first, then last name alone (≥5 chars) as a fallback.
 * Returns the matched patient or null.
 */
function detectNamedPatient(
  lowerMessage: string,
  census: Patient[],
): Patient | null {
  for (const p of census) {
    const fullName = p.name.toLowerCase();
    if (lowerMessage.includes(fullName)) return p;
    // Last-name fallback — only if distinctive enough to avoid false positives
    const parts = fullName.split(/\s+/);
    const lastName = parts[parts.length - 1];
    if (lastName.length >= 5 && lowerMessage.includes(lastName)) return p;
  }
  return null;
}

/**
 * Build a compact roster of all census patients to prepend to cohort queries.
 * Gives the LLM individual patient context for population-level questions.
 */
// Known antibiotic keywords (lowercase substring match)
export const ANTIBIOTIC_KEYWORDS = [
  "vancomycin",
  "ceftriaxone",
  "cefazolin",
  "cefepime",
  "meropenem",
  "piperacillin",
  "tazobactam",
  "ciprofloxacin",
  "levofloxacin",
  "azithromycin",
  "amoxicillin",
  "ampicillin",
  "doxycycline",
  "clindamycin",
  "metronidazole",
  "trimethoprim",
  "sulfamethoxazole",
  "nitrofurantoin",
  "linezolid",
];

// Meds associated with elevated fall risk
export const FALL_RISK_MED_KEYWORDS = [
  // Opioids
  "morphine",
  "oxycodone",
  "hydrocodone",
  "fentanyl",
  "codeine",
  "tramadol",
  "hydromorphone",
  // Benzodiazepines / sedatives / hypnotics
  "lorazepam",
  "diazepam",
  "midazolam",
  "alprazolam",
  "clonazepam",
  "zolpidem",
  "temazepam",
  "haloperidol",
  "quetiapine",
  "olanzapine",
  // Antihypertensives / diuretics causing orthostatic hypotension
  "furosemide",
  "lisinopril",
  "amlodipine",
  "metoprolol",
  "carvedilol",
  "hydralazine",
  "prazosin",
  "doxazosin",
  "tizanidine",
];

function buildCensusRoster(census: Patient[]): string {
  const lines = census
    .map((p) => {
      const dx = getEffectiveDiagnosis(p) ?? "No active dx";
      const allMeds = p.meds.map((m) => m.toLowerCase());

      // Clinical category flags
      const flags: string[] = [];
      if (p.riskScore > 0.65) flags.push("HIGH RISK");
      if (p.labs.some((l) => l.flag === "critical"))
        flags.push("CRITICAL LABS");
      if (p.labs.some((l) => l.flag === "high" || l.flag === "low"))
        flags.push("ABNORMAL LABS");

      // Vitals — critical level
      const v = p.vitals;
      if (v.hr !== null && (v.hr > 120 || v.hr < 50)) flags.push("HR CRITICAL");
      else if (v.hr !== null && (v.hr > 100 || v.hr < 60))
        flags.push("HR ABNORMAL");
      if (v.bpSys !== null && v.bpSys < 80) flags.push("BP CRITICAL");
      else if (v.bpSys !== null && (v.bpSys < 90 || v.bpSys > 160))
        flags.push("BP ABNORMAL");
      if (v.spo2 !== null && v.spo2 < 90) flags.push("SPO2 CRITICAL");
      else if (v.spo2 !== null && v.spo2 < 94) flags.push("SPO2 LOW");
      if (v.rr !== null && (v.rr > 28 || v.rr < 10)) flags.push("RR CRITICAL");
      else if (v.rr !== null && (v.rr > 20 || v.rr < 12))
        flags.push("RR ABNORMAL");
      if (v.temp !== null && (v.temp > 103 || v.temp < 96))
        flags.push("TEMP CRITICAL");
      else if (v.temp !== null && v.temp > 100.4) flags.push("FEVER");

      // Medication category flags
      const onAntibiotics = allMeds.some((m) =>
        ANTIBIOTIC_KEYWORDS.some((kw) => m.includes(kw)),
      );
      if (onAntibiotics) {
        const abx = p.meds.filter((m) =>
          ANTIBIOTIC_KEYWORDS.some((kw) => m.toLowerCase().includes(kw)),
        );
        flags.push(`ANTIBIOTICS: ${abx.join(", ")}`);
      }
      const fallRiskMeds = p.meds.filter((m) =>
        FALL_RISK_MED_KEYWORDS.some((kw) => m.toLowerCase().includes(kw)),
      );
      if (fallRiskMeds.length > 0)
        flags.push(`FALL-RISK MEDS: ${fallRiskMeds.join(", ")}`);

      return (
        `- ${p.name} | Age ${p.age} | Rm ${p.room} | Dx: ${dx} | Risk: ${p.riskScore.toFixed(2)}` +
        (flags.length ? ` | FLAGS: ${flags.join("; ")}` : " | FLAGS: none")
      );
    })
    .join("\n");
  return (
    `[LIVE UNIT CENSUS — ${census.length} patients. ` +
    `Use this roster as the authoritative source for all patient names, rooms, ages, diagnoses, medications, and clinical flags.]\n` +
    lines
  );
}

/**
 * Generate a mock response based on the user message and optional patient context.
 * Returns content + citations for source attribution.
 */
export interface GenerateResponseResult {
  response: ChatResponse;
  /** When the user names a patient not currently selected, this is that patient. */
  matchedPatient?: Patient;
}

export async function generateResponse(
  message: string,
  _selectedPatient: Patient | null,
  _conversationHistory: ChatMessage[],
  _liveCensus: Patient[] = [],
): Promise<GenerateResponseResult> {
  const lower = message.toLowerCase();

  // Detect Global Intent: cohort-level or comparison questions
  const COHORT_KEYWORDS = [
    "unit",
    "floor",
    "everyone",
    "census",
    "all patients",
    "rank",
    "ranking",
    "ranked",
    "compared to",
    "compare to",
    "other patients",
    "rest of",
    "relative to",
    "versus",
    " vs ",
    "across the",
    "on the unit",
    // Population / listing queries
    "top ",
    "who are",
    "who is the",
    "which patients",
    "which patient",
    "our patients",
    "our top",
    "list ",
    "highest risk",
    "most critical",
    "most urgent",
    "sickest",
    "any patients",
    "how many patients",
  ];
  const hasCohortKeyword = COHORT_KEYWORDS.some((kw) => lower.includes(kw));

  // Name detection: if the message names a specific patient from the census,
  // treat it as a single-patient query even if no one is selected in the table.
  const namedPatient =
    !hasCohortKeyword && _liveCensus.length > 0
      ? detectNamedPatient(lower, _liveCensus)
      : null;

  // effectivePatient: explicit selection > named in message > null
  const effectivePatient = _selectedPatient ?? namedPatient;

  // Did the chat detect a different patient than what's selected?
  const didMatchNewPatient =
    namedPatient != null && namedPatient.id !== _selectedPatient?.id;

  // Global if no patient can be resolved, OR explicit cohort keyword present
  const isGlobalIntent = !effectivePatient || hasCohortKeyword;

  /** Wrap a ChatResponse with the matched patient info when applicable. */
  function wrap(cr: ChatResponse): GenerateResponseResult {
    if (didMatchNewPatient) {
      return {
        response: {
          ...cr,
          content: `*I pulled up **${namedPatient!.name}**'s chart for you.*\n\n${cr.content}`,
        },
        matchedPatient: namedPatient!,
      };
    }
    return { response: cr };
  }

  // ── Build live frontend context to inject into every LLM call ──
  // Snowflake tables are often stale or empty; the frontend data is always current.
  // We prepend it so the LLM always has the real values regardless of what's in SF.
  function buildLivePatientContext(p: Patient): string {
    const v = p.vitals;
    const fmt = (val: number | null, unit: string) =>
      val !== null ? `${val} ${unit}` : "N/A";
    const vitalsLine = v
      ? `HR=${fmt(v.hr, "bpm")}, BP=${v.bpSys !== null && v.bpDia !== null ? `${v.bpSys}/${v.bpDia} mmHg` : "N/A"}, Temp=${fmt(v.temp, "°F")}, SpO2=${fmt(v.spo2, "%")}, RR=${fmt(v.rr, "/min")}${v.timestamp ? ` (recorded ${new Date(v.timestamp).toLocaleString()})` : ""}`
      : "No vitals on file";
    const labLines =
      p.labs.length > 0
        ? p.labs
            .map(
              (l) =>
                `${l.name}: ${l.value} ${l.unit}${l.flag !== "normal" ? ` [${l.flag.toUpperCase()}]` : ""}`,
            )
            .join("; ")
        : "No labs on file";
    const medsLine = p.meds.length > 0 ? p.meds.join(", ") : "None documented";
    const allergiesLine =
      p.allergies.length > 0 ? p.allergies.join(", ") : "NKDA";
    return [
      `PATIENT: ${p.name}, ${p.age}yo ${p.sex}, Room ${p.room}, MRN ${p.mrn}`,
      `DIAGNOSIS: ${p.diagnosis || "No active conditions"}`,
      `VITALS: ${vitalsLine}`,
      `LABS: ${labLines}`,
      `MEDICATIONS: ${medsLine}`,
      `ALLERGIES: ${allergiesLine}`,
    ].join("\n");
  }

  // ── Short-circuit: pure clinical knowledge (no patient, no cohort intent) ──
  // If the question has no patient context and no cohort keyword but matches a
  // known clinical topic, answer from the local evidence library immediately.
  // This avoids 60 s+ Snowflake/LLM round-trips for questions like
  // "does acetaminophen interact with clonazepam?" which need no patient data.
  if (!effectivePatient && !hasCohortKeyword) {
    const knowledgeTopic = matchTopic(message);
    if (knowledgeTopic !== null && CLINICAL_RESPONSES[knowledgeTopic]) {
      const entry = CLINICAL_RESPONSES[knowledgeTopic][0];
      // Brief simulated latency for UX consistency
      await new Promise((r) => setTimeout(r, 80 + Math.random() * 120));
      return wrap({ content: entry.content, citations: entry.citations });
    }
  }

  // ── Try Snowflake RAG ──
  try {
    if (isGlobalIntent) {
      // Prepend the full live census roster so Cortex can reason over ALL
      // patients by name, not just aggregate stats or the top-5 risk list.
      let enrichedMessage = message;
      if (effectivePatient) {
        enrichedMessage = `Regarding patient ${effectivePatient.name} (Diagnosis: ${effectivePatient.diagnosis}, Risk Score: ${effectivePatient.riskScore.toFixed(2)}): ${message}`;
      }
      if (_liveCensus.length > 0) {
        const roster = buildCensusRoster(_liveCensus);
        enrichedMessage = `${roster}\n\nNURSE QUESTION: ${enrichedMessage}`;
      }
      const gResult = await askSnowflakeCohortQuestion(enrichedMessage);
      if (gResult) {
        const fc = detectFilterIntent(message);
        const topicCites = getTopicCitations(message);
        const merged = [
          ...gResult.citations,
          ...topicCites.filter(
            (tc) => !gResult.citations.some((gc) => gc.title === tc.title),
          ),
        ];
        const enriched: ChatResponse = { ...gResult, citations: merged };
        return wrap(fc ? { ...enriched, filterCommand: fc } : enriched);
      }
    } else if (effectivePatient) {
      // Inject live frontend data into the question so Cortex always has current values
      const liveContext = buildLivePatientContext(effectivePatient);
      const enrichedQuestion = `[LIVE EHR DATA — use this as the authoritative source for vitals, labs, and medications]\n${liveContext}\n\nNURSE QUESTION: ${message}`;
      const sfResult = await askSnowflakeQuestion(
        effectivePatient.id,
        enrichedQuestion,
      );
      if (sfResult) {
        const fc = detectFilterIntent(message);
        const topicCites = getTopicCitations(message);
        const sfCites = sfResult.citations.map((c) => ({
          title: c.title,
          source: c.source,
          url: c.url,
        }));
        // Merge: Snowflake sources first, then non-duplicate professional sources
        const merged = [
          ...sfCites,
          ...topicCites.filter(
            (tc) => !sfCites.some((sc) => sc.title === tc.title),
          ),
        ];
        return wrap({
          content: sfResult.answer,
          citations: merged,
          ...(fc ? { filterCommand: fc } : {}),
        });
      }
    }
  } catch {
    // Snowflake unavailable — fall through to mock
  }

  // ── Fallback: local mock responses ──
  // Simulate network / LLM latency
  // ── Fallback: Snowflake was unreachable — build a data-grounded response locally ──
  // Only reached when the LLM is completely unavailable. Uses live frontend data, not canned strings.
  await new Promise((resolve) =>
    setTimeout(resolve, 400 + Math.random() * 400),
  );

  // For cohort/global questions, compute answers from the live census
  if (isGlobalIntent && _liveCensus.length > 0) {
    const cohortSorted = [..._liveCensus].sort(
      (a, b) => b.riskScore - a.riskScore,
    );
    const dxCount: Record<string, number> = {};
    for (const p of _liveCensus) {
      const dx = getEffectiveDiagnosis(p);
      if (dx) dxCount[dx] = (dxCount[dx] || 0) + 1;
    }
    const sortedDx = Object.entries(dxCount).sort((a, b) => b[1] - a[1]);
    const highRisk = cohortSorted.filter((p) => p.riskScore > 0.8).length;
    const total = _liveCensus.length;
    const unitAvg = (
      cohortSorted.reduce((s, p) => s + p.riskScore, 0) / total
    ).toFixed(2);
    const topDx =
      sortedDx
        .slice(0, 3)
        .map(([dx]) => dx)
        .join(", ") || "unavailable";

    // Ranking query with a patient selected
    if (_selectedPatient) {
      const rank =
        cohortSorted.findIndex((p) => p.id === _selectedPatient!.id) + 1;
      const topAbove = cohortSorted.filter(
        (p) => p.riskScore > _selectedPatient!.riskScore,
      ).length;
      return wrap({
        content:
          `**${_selectedPatient.name}** has a risk score of **${_selectedPatient.riskScore.toFixed(2)}**, ranking **#${rank} of ${total}** on the unit.\n` +
          `${topAbove} patient${topAbove !== 1 ? "s have" : " has"} a higher score. Unit average: ${unitAvg}.\n` +
          (highRisk > 0
            ? `\n${highRisk} patient${highRisk !== 1 ? "s are" : " is"} high-risk (score > 0.80).`
            : "") +
          `\n\n*Note: AI assistant temporarily unavailable — data sourced directly from live census.*`,
        citations: [
          { title: "Live Census Analytics", source: "Live Census", url: "#" },
        ],
      });
    }

    // General cohort question
    const withAbnormal = _liveCensus.filter((p) =>
      p.labs.some((l) => l.flag !== "normal"),
    ).length;
    return wrap({
      content:
        `**Unit Census — ${total} patients** *(AI offline — live data only)*\n\n` +
        `• High-risk (score > 0.80): **${highRisk}**\n` +
        `• Average risk score: **${unitAvg}**\n` +
        `• Patients with abnormal labs: **${withAbnormal}**\n` +
        `• Top diagnoses: ${topDx}\n` +
        (cohortSorted[0]
          ? `• Highest risk: **${cohortSorted[0].name}** (${cohortSorted[0].riskScore.toFixed(2)})\n`
          : ""),
      citations: [
        { title: "Live Census Analytics", source: "Live Census", url: "#" },
      ],
    });
  }

  // For single-patient questions, use the live frontend data directly
  if (effectivePatient) {
    const liveContext = buildLivePatientContext(effectivePatient);
    // Try dynamic patient-specific responses for vitals / meds
    const intentForDynamic =
      /\b(vital|heart rate|blood pressure|spo2|temp|resp)\b/i.test(message)
        ? "vitals"
        : /\b(med|drug|dose|administer|mar|high.alert|interaction)\b/i.test(
              message,
            )
          ? "meds"
          : /\b(recommend|intervention|care plan|priority|action|next step)\b/i.test(
                message,
              )
            ? "recs"
            : null;
    if (intentForDynamic) {
      const dynamic = generateDynamicResponse(
        intentForDynamic,
        effectivePatient,
      );
      return wrap(dynamic);
    }
    // Topic-matched professional response if available
    const patientTopic = matchTopic(message);
    if (patientTopic && CLINICAL_RESPONSES[patientTopic]) {
      const responses = CLINICAL_RESPONSES[patientTopic];
      const base = responses[msgCounter % responses.length];
      msgCounter++;
      return wrap({
        content:
          `*Context: **${effectivePatient.name}** · Rm ${effectivePatient.room} · Dx: ${effectivePatient.diagnosis || "No active dx"}*\n\n` +
          base.content,
        citations: base.citations,
      });
    }
    return wrap({
      content:
        `*AI assistant temporarily unavailable. Here is the current data on file for ${effectivePatient.name}:*\n\n` +
        liveContext
          .split("\n")
          .map((line) => `• ${line}`)
          .join("\n"),
      citations: [
        { title: "EHR Record", source: "Live Patient Data", url: "#" },
      ],
    });
  }

  // No patient context — try topic-matched protocol answer
  const genericTopic = matchTopic(message);
  if (genericTopic && CLINICAL_RESPONSES[genericTopic]) {
    const responses = CLINICAL_RESPONSES[genericTopic];
    const base = responses[msgCounter % responses.length];
    msgCounter++;
    return wrap(base);
  }

  return wrap({
    content: `AI assistant is temporarily unavailable. Please try again shortly or consult the EHR directly.`,
    citations: [],
  });
}

/** Helper to generate dynamic, patient-aware responses based on actual passed data */
function generateDynamicResponse(
  intent: "vitals" | "meds" | "recs",
  patient: Patient,
): TopicResponse {
  if (intent === "vitals") {
    let vitalsSummary = "**Recent Vitals Trends:**\n\n";
    if (patient.vitals) {
      vitalsSummary += `• **Heart Rate:** ${patient.vitals.hr || "--"} bpm\n`;
      vitalsSummary += `• **Blood Pressure:** ${patient.vitals.bpSys || "--"}/${patient.vitals.bpDia || "--"} mmHg\n`;
      vitalsSummary += `• **Resp Rate:** ${patient.vitals.rr || "--"} breaths/min\n`;
      vitalsSummary += `• **Temperature:** ${patient.vitals.temp || "--"} °F\n`;
      vitalsSummary += `• **SpO2:** ${patient.vitals.spo2 || "--"}%\n\n`;

      const alerts = [];
      if (
        patient.vitals.hr &&
        (patient.vitals.hr > 100 || patient.vitals.hr < 60)
      )
        alerts.push("Abnormal Heart Rate");
      if (
        patient.vitals.bpSys &&
        (patient.vitals.bpSys > 140 || patient.vitals.bpSys < 90)
      )
        alerts.push("Abnormal Blood Pressure");
      if (patient.vitals.spo2 && patient.vitals.spo2 < 92)
        alerts.push("Low Oxygen Saturation");
      if (patient.vitals.temp && patient.vitals.temp > 100.4)
        alerts.push("Elevated Temperature");

      if (alerts.length > 0) {
        vitalsSummary += `🚨 **Alerts detected:** ${alerts.join(", ")}. Recommend continuous telemetry monitoring and provider notification if persistent.`;
      } else {
        vitalsSummary +=
          "✅ Vitals appear stable and within typical ranges. Recommend routine monitoring per unit protocol.";
      }
    } else {
      vitalsSummary = "No recent vitals available for this patient.";
    }

    return {
      content: vitalsSummary,
      citations: [
        {
          title: "Patient Vitals Flowsheet",
          source: "Local EHR Data",
          url: "#",
        },
      ],
    };
  }

  if (intent === "meds") {
    let medsSummary = "**Medication Review:**\n\n";
    if (patient.meds && patient.meds.length > 0) {
      medsSummary += `Patient is currently on **${patient.meds.length} active medications**.\n\n`;
      const highAlertKeywords = [
        "insulin",
        "heparin",
        "warfarin",
        "morphine",
        "oxycodone",
        "fentanyl",
        "propofol",
        "amiodarone",
      ];
      const foundHighAlert = patient.meds.filter((m) =>
        highAlertKeywords.some((k) => m.toLowerCase().includes(k)),
      );

      if (foundHighAlert.length > 0) {
        medsSummary += `🚨 **High-Alert Medications Found:**\n`;
        foundHighAlert.forEach((m) => {
          medsSummary += `• ${m}\n`;
        });
        medsSummary += `\n*Action:* Double-check dosage and parameters before administration. Ensure independent double-verification if required by policy.\n`;
      } else {
        medsSummary += `✅ No standard high-alert medications match in the current list. Always perform the 5 Rights of Medication Administration.\n`;
      }
    } else {
      medsSummary = "No active medications found in the current record.";
    }

    return {
      content: medsSummary,
      citations: [
        { title: "Current MAR", source: "Local EHR Data", url: "#" },
        {
          title: "High-Alert Medications",
          source: "ISMP",
          url: "https://www.ismp.org/recommendations/high-alert-medications-acute-list",
        },
      ],
    };
  }

  if (intent === "recs") {
    let recs = `**Nursing Care Recommendations for ${patient.name}**\n\n`;
    recs += `**Primary Diagnosis:** ${patient.diagnosis}\n\n`;
    recs += "**Priority Interventions:**\n";
    recs +=
      "1. **Assess:** Perform comprehensive primary assessment focusing on symptomatic relief.\n";
    recs +=
      "2. **Monitor:** Trending vitals q4h and escalating parameters outside baseline.\n";

    const abnormalLabs = patient.labs.filter((l) => l.flag !== "normal");
    if (abnormalLabs.length > 0) {
      recs += `3. **Lab Follow-Up:** Monitor specifically for changes in: **${abnormalLabs.map((l) => l.name).join(", ")}** as these are currently flagged abnormal.\n`;
    } else {
      recs +=
        "3. **Lab Follow-Up:** Routine morning draws. No critical values currently flagged.\n";
    }

    recs +=
      "4. **Education:** Review care plan and discharge criteria with patient/family.\n\n";
    recs +=
      "*Note: Recommendations generated dynamically. Always rely on clinical judgment and standing orders.*";

    return {
      content: recs,
      citations: [
        {
          title: "Clinical Care Pathways",
          source: "Hospital Policies",
          url: "#",
        },
      ],
    };
  }

  return GENERAL_RESPONSES[0];
}

/**
 * Detect explicit filter intent in a chat message.
 * ONLY fires when the user uses clear filter-command language
 * ("show me only …", "filter to …", "narrow to …").
 * Returns null for plain questions about topics.
 */
export function detectFilterIntent(message: string): FilterCommand | null {
  const lower = message.toLowerCase();

  // Clear / reset intent
  if (
    /\b(clear|remove|reset)\b.*\b(filter|search)\b/i.test(lower) ||
    /\bshow\s+all\s+patients\b/i.test(lower)
  ) {
    return { type: "clear", label: "All patients" };
  }

  // Must contain an explicit filter/show/narrow verb + scope word
  const hasFilterVerb =
    /\b(show|filter|narrow|display|limit|focus)\b/.test(lower) &&
    /\b(only|just|to|me|down)\b/.test(lower);
  if (!hasFilterVerb) return null;

  // Risk tier
  if (/high[- ]?risk|risk.*high/i.test(lower))
    return { type: "risk", riskMin: 0.65, label: "High risk (score > 0.65)" };
  if (/low[- ]?risk|risk.*low/i.test(lower))
    return { type: "risk", riskMax: 0.4, label: "Low risk (score < 0.40)" };
  if (/mod(?:erate)?[- ]?risk|medium[- ]?risk/i.test(lower))
    return {
      type: "risk",
      riskMin: 0.4,
      riskMax: 0.65,
      label: "Moderate risk (0.40 – 0.65)",
    };

  // Clinical flags
  if (/antibiotic/i.test(lower))
    return { type: "flag", flag: "antibiotics", label: "On antibiotics" };
  if (/fall[- ]?risk|at.?risk.?fall/i.test(lower))
    return { type: "flag", flag: "fall-risk", label: "Fall-risk medications" };
  if (/critical[- ]?lab|lab.*critical/i.test(lower))
    return { type: "flag", flag: "critical-labs", label: "Critical labs" };

  // Diagnosis / free-text search — extract the key term
  const dxMatch = lower.match(
    /(?:show|filter|narrow).*?(?:with|for|diagnos\w*|having)\s+([a-z][a-z\s-]{2,30?})(?:\s+patients?|\s*$)/,
  );
  if (dxMatch) {
    const term = dxMatch[1].trim();
    if (term.length > 2)
      return { type: "search", text: term, label: `"${term}"` };
  }

  return null;
}

/**
 * Score every patient in the census against a free-text clinical question
 * using Snowflake Cortex. Returns a name→label map (YES / POSSIBLE / NO / N/A)
 * or an error string when Snowflake is unavailable.
 */
export async function runQueryColumnBatch(
  question: string,
  census: Patient[],
): Promise<{ results: Map<string, string>; error?: string }> {
  if (!census.length)
    return { results: new Map(), error: "No patients in census" };

  // Build a condensed roster: just enough for LLM scoring
  const rosterLines = census.map((p) => {
    const dx = getEffectiveDiagnosis(p) ?? "No active dx";
    const flags: string[] = [];
    if (p.riskScore > 0.65) flags.push("HIGH RISK");
    if (p.labs.some((l) => l.flag === "critical")) flags.push("CRITICAL LABS");
    if (p.labs.some((l) => l.flag === "high" || l.flag === "low"))
      flags.push("ABNORMAL LABS");
    const v = p.vitals;
    if (v.hr != null && (v.hr > 120 || v.hr < 50)) flags.push("HR CRITICAL");
    if (v.bpSys != null && v.bpSys < 90) flags.push("BP LOW");
    if (v.spo2 != null && v.spo2 < 94) flags.push("SPO2 LOW");
    if (v.temp != null && v.temp > 100.4) flags.push("FEVER");
    const allMeds = p.meds.map((m) => m.toLowerCase());
    if (allMeds.some((m) => ANTIBIOTIC_KEYWORDS.some((kw) => m.includes(kw))))
      flags.push("ON ANTIBIOTICS");
    if (
      allMeds.some((m) => FALL_RISK_MED_KEYWORDS.some((kw) => m.includes(kw)))
    )
      flags.push("FALL-RISK MEDS");
    return `- ${p.name} | Age ${p.age} | Dx: ${dx} | Risk: ${p.riskScore.toFixed(2)}${
      flags.length ? " | " + flags.join("; ") : ""
    }`;
  });

  const prompt =
    `You are scoring inpatients for a clinical triage column.\n` +
    `INSTRUCTIONS:\n` +
    `• For each patient below, answer the clinical question with exactly one label: YES, POSSIBLE, NO, or N/A\n` +
    `• YES = question clearly applies | POSSIBLE = partial evidence | NO = clearly does not apply | N/A = insufficient data\n` +
    `• Return ONLY valid JSON — no markdown fences, no explanation, no other text\n\n` +
    `CLINICAL QUESTION: ${question}\n\n` +
    `PATIENTS:\n${rosterLines.join("\n")}\n\n` +
    `Return this exact structure (use the patient\'s full name as the key):\n` +
    `{"Patient Full Name": "YES", "Other Patient": "NO", ...}\n\nJSON:`;

  const result = await askSnowflakeCohortQuestion(prompt);
  if (!result)
    return {
      results: new Map(),
      error:
        "Snowflake unavailable — connect to Snowflake to use this feature.",
    };

  // Extract JSON — handles both raw and markdown-fenced responses
  const raw = result.content;
  const jsonMatch =
    raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
  if (!jsonMatch)
    return {
      results: new Map(),
      error: "Could not parse LLM response as JSON.",
    };

  try {
    const parsed: Record<string, string> = JSON.parse(
      jsonMatch[1] ?? jsonMatch[0],
    );
    const map = new Map<string, string>();
    for (const [name, label] of Object.entries(parsed)) {
      map.set(name.trim(), String(label).trim().toUpperCase());
    }
    return { results: map };
  } catch {
    return {
      results: new Map(),
      error: "JSON parse error — try rephrasing the question.",
    };
  }
}

/** Quick-reply suggestions to get nurses started */
export function getSuggestions(selectedPatient: Patient | null): string[] {
  if (selectedPatient) {
    return [
      `What should I watch for with ${selectedPatient.diagnosis}?`,
      "Any medication interactions to be aware of?",
      "Help me write an SBAR for this patient",
      "When should I escalate?",
    ];
  }
  return [
    "What's the sepsis bundle protocol?",
    "When should I call a rapid response?",
    "Help me interpret critical lab values",
    "Fall prevention best practices",
  ];
}

/**
 * Ask a cohort-level question via Snowflake without a specific patientId.
 */
async function askSnowflakeCohortQuestion(
  question: string,
): Promise<ChatResponse | null> {
  if (typeof window === "undefined" || !window.electronAPI?.snowflake)
    return null;

  try {
    const result = await window.electronAPI!.snowflake.query(
      undefined,
      question,
    );
    if (result.success) {
      return {
        content: result.answer,
        citations: result.citations || [],
      };
    }
    return null;
  } catch {
    return null;
  }
}
