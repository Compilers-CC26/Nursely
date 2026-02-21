-- ============================================================
-- Seed Knowledge Base — Sample Hospital Protocols
-- These serve as the RAG source for Cortex Search
-- ============================================================

INSERT INTO knowledge_base (doc_id, source_title, content, category, policy_id, version, published_date)
VALUES

-- 1. Sepsis Bundle
('KB-001', 'SEP-1 Early Management Bundle — Severe Sepsis / Septic Shock',
'PURPOSE: Early identification and treatment of sepsis to reduce mortality.

CRITERIA FOR ACTIVATION:
- Suspected or confirmed infection AND
- 2+ SIRS criteria (Temp >38.3°C or <36°C, HR >90, RR >20, WBC >12k or <4k) OR
- qSOFA ≥ 2 (altered mentation, SBP ≤100, RR ≥22)

3-HOUR BUNDLE (from time zero = triage or recognition):
1. Measure serum lactate level
2. Obtain blood cultures (2 sets, at least 1 peripheral) BEFORE antibiotics
3. Administer broad-spectrum antibiotics within 1 hour of recognition
4. Begin rapid infusion of 30 mL/kg crystalloid for hypotension OR lactate ≥ 4 mmol/L

6-HOUR BUNDLE (if septic shock):
5. Apply vasopressors (norepinephrine first-line) if MAP <65 after fluid resuscitation
6. Remeasure lactate if initial lactate was >2 mmol/L (target: lactate clearance ≥10%/2hr)
7. Reassess volume status and tissue perfusion (focused clinical exam or dynamic measures)

DOCUMENTATION: Record time zero, each bundle element completion time, and code status.
ESCALATION: ICU consult if any vasopressor requirement or lactate >4 after initial resuscitation.
NURSING ACTIONS: Continuous telemetry, strict I&O, foley for UOP monitoring, q1h vitals during resuscitation.',
'protocol', 'SEP-001', '4.2', '2024-01-15'),

-- 2. Fall Prevention
('KB-002', 'Fall Prevention Protocol — Acute Care Inpatient',
'PURPOSE: Reduce preventable falls and fall-related injuries.

RISK ASSESSMENT: Morse Fall Scale on admission, every shift, and with any status change.
- Score 0-24: Low Risk
- Score 25-50: Moderate Risk
- Score 51+: High Risk

LOW RISK INTERVENTIONS:
- Orient to room, call light, bathroom
- Non-skid footwear
- Bed in low position, wheels locked

MODERATE/HIGH RISK INTERVENTIONS (add to above):
- Yellow fall risk wristband and door sign
- Bed alarm activated
- Toileting schedule every 2 hours
- Personal items within reach
- Night light on
- 1:1 sitter consideration for high risk
- Medication review for fall-risk contributors (sedatives, antihypertensives, opioids)

POST-FALL PROTOCOL:
1. Assess for injury — neuro check if head involved
2. Notify provider within 15 minutes
3. Complete incident report (Safety Event System)
4. Reassess fall risk score
5. Implement additional interventions as needed
6. Huddle with care team within 1 hour

DOCUMENTATION: Fall risk score, interventions in place, patient/family education.',
'protocol', 'FALL-001', '3.1', '2024-03-01'),

-- 3. Pain Management
('KB-003', 'Pain Assessment and Management — Nursing Standards',
'PURPOSE: Ensure consistent, evidence-based pain management.

ASSESSMENT TOOLS:
- Verbal patients: Numeric Rating Scale (NRS) 0-10
- Non-verbal/intubated: CPOT (Critical-Care Pain Observation Tool) or FLACC
- Cognitively impaired: PAINAD scale

ASSESSMENT FREQUENCY:
- With every vital sign assessment
- Before and after pain interventions (30 min post-IV, 60 min post-PO)
- On admission, transfer, and discharge

NON-PHARMACOLOGIC INTERVENTIONS (try first when appropriate):
- Repositioning, elevation
- Ice/heat therapy
- Relaxation techniques, guided imagery
- Distraction (music, conversation)
- TENS unit if ordered

PHARMACOLOGIC GUIDELINES:
- Follow WHO analgesic ladder: non-opioid → weak opioid → strong opioid
- High-alert medications (opioids): two-nurse verification for IV push
- PCA: patient education required, assess sedation scale q1h
- Multimodal approach preferred (acetaminophen + NSAID + opioid PRN)

OPIOID SAFETY:
- Pasero Opioid-Induced Sedation Scale (POSS) with every opioid administration
- Naloxone 0.4mg at bedside for patients on continuous opioids
- Respiratory rate <10: HOLD opioid, notify provider, assess airway

DOCUMENTATION: Pain score, intervention, reassessment score, functional impact.',
'guideline', 'PAIN-001', '2.5', '2024-02-15'),

-- 4. Rapid Response
('KB-004', 'Rapid Response Team (RRT) Activation Criteria',
'PURPOSE: Early intervention for patients with acute clinical deterioration.

ACTIVATION CRITERIA (any one triggers RRT call):
- Acute change in mental status
- Heart rate <50 or >130
- Systolic BP <90 or >200
- Respiratory rate <10 or >28
- SpO2 <90% despite supplemental oxygen
- New-onset chest pain
- Acute neurological change (new weakness, slurred speech, seizure)
- Acute change in urine output (<0.5 mL/kg/hr for 2 hours)
- Nurse concern / "something is not right"

HOW TO ACTIVATE:
1. Call RRT extension: x5555 (overhead: "Rapid Response to [location]")
2. Stay with patient, begin interventions within scope
3. Prepare for team: latest vitals, medications, recent changes, code status

RRT COMPOSITION: ICU RN, respiratory therapist, MD/NP from ICU
EXPECTED RESPONSE TIME: <5 minutes

NURSING RESPONSIBILITY:
- Document vitals and trigger for activation
- Have chart, MAR, and current medications available
- Brief team using SBAR format
- Remain as bedside nurse during RRT evaluation
- Complete RRT documentation form within 1 hour

ESCALATION: If patient does not stabilize → Code Blue (x2222)
POST-RRT: Debrief with charge nurse, update care plan, increase monitoring frequency.',
'protocol', 'RRT-001', '5.0', '2024-01-01'),

-- 5. Medication Administration Safety
('KB-005', 'High-Alert Medication Administration — Safety Standards',
'PURPOSE: Prevent medication errors with high-alert medications.

HIGH-ALERT MEDICATIONS (ISMP List):
- Anticoagulants (heparin, warfarin, enoxaparin)
- Insulin (all formulations)
- Opioids (IV, PCA, transdermal)
- Neuromuscular blocking agents
- Concentrated electrolytes (KCl, MgSO4, hypertonic saline)
- Vasoactive infusions (norepinephrine, vasopressin, dopamine)
- Chemotherapy

REQUIRED SAFEGUARDS:
1. Independent double-check (two licensed nurses) for:
   - IV insulin drips
   - IV heparin infusions
   - PCA pumps (programming verification)
   - Chemotherapy
   - Epidural medications
2. Smart pump with drug library (NO manual overrides without pharmacist approval)
3. Patient identification: scan armband + medication barcode

5 RIGHTS VERIFICATION:
- Right Patient (two identifiers: name + DOB/MRN)
- Right Drug (compare MAR to vial/bag)
- Right Dose (independent calculation for weight-based)
- Right Route
- Right Time (within 30-minute window for scheduled meds)

ADDITIONAL RIGHTS:
- Right Documentation (immediately after administration)
- Right Reason (indication documented)
- Right Response (assess within appropriate timeframe)

INSULIN SAFETY:
- Always verify blood glucose before administration
- Do NOT abbreviate "U" for units — write out "units"
- Two-nurse check for all IV insulin
- Hypoglycemia protocol posted at bedside

ANTICOAGULANT SAFETY:
- Verify INR/aPTT before dosing (warfarin/heparin)
- Assess for signs of bleeding each shift
- Fall precautions for all anticoagulated patients',
'policy', 'MEDSAFE-001', '6.0', '2024-04-01'),

-- 6. Code Blue
('KB-006', 'Code Blue Response — Cardiac Arrest Protocol',
'PURPOSE: Standardized response to in-hospital cardiac arrest.

ACTIVATION: Dial x2222, overhead "Code Blue to [location]"

FIRST RESPONDER (discovering nurse):
1. Assess responsiveness — tap and shout
2. Call for help / activate code
3. Begin high-quality CPR immediately:
   - 30:2 ratio (until advanced airway)
   - Rate: 100-120 compressions/min
   - Depth: at least 2 inches
   - Full chest recoil between compressions
   - Minimize interruptions (<10 seconds)
4. Apply AED/defibrillator as soon as available
5. Attach monitor — analyze rhythm

CODE TEAM ROLES:
- Team Leader: directs resuscitation, makes decisions
- Compressor: rotates every 2 minutes
- Airway: bag-valve-mask, then advanced airway
- IV/Medications: access, epinephrine q3-5min
- Recorder: documents events, timing, medications
- Runner: brings supplies, blood products

ACLS ALGORITHMS:
- VF/pVT: Shock → CPR 2 min → Shock → Epi → Shock → Amiodarone
- PEA/Asystole: CPR → Epi q3-5min → identify reversible causes
- H''s: Hypovolemia, Hypoxia, H+, Hypo/Hyperkalemia, Hypothermia
- T''s: Tension pneumothorax, Tamponade, Toxins, Thrombosis

POST-ROSC:
- 12-lead ECG within 10 minutes
- Targeted temperature management consideration
- ICU transfer
- Debrief within 24 hours

DOCUMENTATION: Code record sheet — start time, rhythm checks, meds given, ROSC time or time of death.',
'protocol', 'CODE-001', '7.0', '2024-02-01'),

-- 7. Hand Hygiene
('KB-007', 'Hand Hygiene Compliance — Infection Prevention',
'PURPOSE: Reduce healthcare-associated infections through proper hand hygiene.

WHEN TO PERFORM HAND HYGIENE (WHO 5 Moments):
1. Before touching a patient
2. Before clean/aseptic procedure
3. After body fluid exposure risk
4. After touching a patient
5. After touching patient surroundings

METHOD:
- Alcohol-based hand rub (ABHR): preferred, 20 seconds minimum
- Soap and water REQUIRED for:
  - Visibly soiled hands
  - C. difficile exposure (spores resist alcohol)
  - Before eating
  - After restroom use

GLOVE USE:
- Gloves do NOT replace hand hygiene
- Perform hand hygiene before donning and after doffing
- Change gloves between patients and between dirty/clean tasks on same patient

COMPLIANCE TARGET: ≥90% (monitored by secret shoppers)
REPORTING: Monthly unit-level compliance posted on quality board.',
'policy', 'IC-001', '3.0', '2024-05-01'),

-- 8. Blood Transfusion
('KB-008', 'Blood Product Administration — Nursing Protocol',
'PURPOSE: Safe administration of blood products with early detection of transfusion reactions.

PRE-TRANSFUSION:
1. Verify physician order and informed consent
2. Type and screen / crossmatch confirmed by blood bank
3. Two-nurse bedside verification:
   - Patient identity (armband + verbal)
   - Blood product label matches order
   - ABO/Rh compatibility
   - Expiration date
4. Baseline vitals before starting (temp, HR, BP, RR, SpO2)
5. Ensure patent IV access (≥20G for PRBCs, ≥22G for FFP/platelets)

DURING TRANSFUSION:
- Stay with patient for first 15 minutes (most reactions occur early)
- Vitals: 15 min after start, then q30min, then at completion
- PRBCs: complete within 4 hours of release from blood bank
- Infuse through blood administration set with 170-260 micron filter
- NEVER add medications to blood products
- Only 0.9% NS compatible with blood

TRANSFUSION REACTIONS — STOP TRANSFUSION IF:
- Fever (≥1°C rise from baseline)
- Rigors, chills
- Urticaria, rash, itching
- Dyspnea, wheezing
- Hypotension or hypertension
- Back/flank pain
- Dark urine

IF REACTION OCCURS:
1. STOP the transfusion immediately
2. Keep IV open with NS
3. Notify provider STAT
4. Send blood bag + tubing + blood/urine samples to blood bank
5. Complete transfusion reaction form
6. Monitor vital signs q15min until stable',
'protocol', 'BLOOD-001', '4.0', '2024-03-15'),

-- 9. Pressure Injury Prevention
('KB-009', 'Pressure Injury Prevention and Management',
'PURPOSE: Prevent hospital-acquired pressure injuries (HAPI).

RISK ASSESSMENT: Braden Scale on admission and every shift.
- Score ≤18: At risk
- Score ≤14: High risk
- Score ≤9: Very high risk

PREVENTION BUNDLE:
1. Reposition every 2 hours (q1h if very high risk)
2. Keep head of bed ≤30° when possible
3. Use pressure redistribution surface (foam overlay minimum, consider alternating pressure for Braden ≤14)
4. Moisture management — incontinence care protocol
5. Nutrition consult for Braden ≤14 or albumin <3.0
6. Heel elevation with pillows or heel suspension boots
7. Skin assessment every shift — document in skin assessment flowsheet

STAGING:
- Stage 1: Non-blanchable erythema, intact skin
- Stage 2: Partial thickness, blister or shallow open
- Stage 3: Full thickness, visible fat
- Stage 4: Full thickness, exposed bone/tendon/muscle
- Unstageable: Obscured by slough/eschar
- DTPI: Deep tissue pressure injury (purple/maroon area)

WOUND CARE: Follow wound care nurse recommendations. Do NOT debride without order.',
'guideline', 'SKIN-001', '2.0', '2024-06-01'),

-- 10. Discharge Planning
('KB-010', 'Discharge Planning and Patient Education Standards',
'PURPOSE: Ensure safe transitions of care and reduce 30-day readmissions.

INITIATE ON ADMISSION:
- Identify discharge needs during admission assessment
- Assess: living situation, caregiver support, DME needs, follow-up requirements
- Case management / social work referral for complex patients

DISCHARGE READINESS CRITERIA:
- Clinically stable (vitals trending baseline for ≥24h)
- Able to tolerate PO medications
- Pain controlled on PO regimen
- Wound care manageable at home (or home health ordered)
- Patient/caregiver demonstrates understanding of care plan

TEACH-BACK METHOD — required for:
- Medication changes (new meds, dose changes, discontinued meds)
- Wound care instructions
- Activity restrictions
- Warning signs to return to ED
- Follow-up appointments

MEDICATION RECONCILIATION:
- Compare admission meds → inpatient meds → discharge meds
- Reconcile all discrepancies with provider
- Provide updated medication list to patient
- High-risk medications: ensure fill before discharge

FOLLOW-UP:
- PCP appointment within 7 days (3 days for heart failure)
- Specialist follow-up as ordered
- Provide after-visit summary with all instructions

DOCUMENTATION: Discharge education checklist signed by patient/caregiver.',
'policy', 'DC-001', '3.5', '2024-04-15');
