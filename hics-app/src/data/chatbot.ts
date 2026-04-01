import type { ChatMessage } from '../types';

interface KnowledgeEntry {
  patterns: RegExp[];
  response: string;
}

const knowledgeBase: KnowledgeEntry[] = [
  {
    patterns: [/what is hics/i, /hics stand/i, /hospital incident command/i, /explain hics/i],
    response: `**Hospital Incident Command System (HICS)** is an incident management system designed specifically for hospitals and healthcare facilities.

HICS provides:
- **A standardized organizational structure** for emergency response
- **Clear roles and responsibilities** for all staff
- **Scalable activation** from minor events to full-scale disasters
- **Consistent documentation** and communication protocols

HICS is based on NIMS (National Incident Management System) and ICS (Incident Command System) principles, adapting them for the unique needs of healthcare settings.`,
  },
  {
    patterns: [/incident commander/i, /who is in charge/i, /who leads/i, /ic role/i],
    response: `**The Incident Commander (IC)** is the individual responsible for all aspects of the emergency response, including:

- Setting incident objectives and priorities
- Activating and managing the HICS structure
- Approving the Incident Action Plan (IAP)
- Coordinating with external agencies
- Ensuring staff safety and welfare

The IC is typically a senior administrator or physician. **Unity of Command** means everyone reports to only one supervisor, and only one person is ever the IC at a time.`,
  },
  {
    patterns: [/command staff/i, /safety officer/i, /public information/i, /pio/i, /liaison/i],
    response: `**HICS Command Staff** consists of three positions reporting directly to the Incident Commander:

1. **Safety Officer (SO)** – Monitors safety conditions; can STOP unsafe operations immediately
2. **Public Information Officer (PIO)** – Manages all media communications and public information
3. **Liaison Officer (LNO)** – Coordinates with external agencies and organizations

These three positions support the IC in areas that are too important to delegate to sections but don't directly manage operations.`,
  },
  {
    patterns: [/operations section/i, /operations chief/i, /osc/i, /patient care/i],
    response: `**Operations Section** is responsible for all tactical activities during an incident:

- **Chief:** Operations Section Chief (OSC)
- **Responsibilities:**
  - Direct patient care coordination
  - Implementing the Incident Action Plan
  - Managing clinical resources
  - Overseeing facility security and access control
  - Coordinating patient movement and triage

The Operations Section is typically the first and largest section activated during a hospital emergency.`,
  },
  {
    patterns: [/planning section/i, /planning chief/i, /psc/i, /incident action plan/i, /iap/i],
    response: `**Planning Section** collects, analyzes, and distributes information for decision-making:

- **Chief:** Planning Section Chief (PSC)
- **Key products:**
  - Incident Action Plan (IAP)
  - Situation Status Reports
  - Demobilization Plan
- **Units include:** Situation Status, Resources, Documentation, Demobilization

The IAP is the master planning document that outlines objectives, strategies, and resource assignments for each operational period (typically 8-12 hours).`,
  },
  {
    patterns: [/logistics section/i, /logistics chief/i, /lsc/i, /supply/i, /resources/i],
    response: `**Logistics Section** provides facilities, services, and materials to support the response:

- **Chief:** Logistics Section Chief (LSC)
- **Responsibilities:**
  - Medical supplies and equipment
  - Staff scheduling and feeding
  - Communications equipment
  - Transportation
  - Facility management
- **Units include:** Supply, Communications, Food, Transportation

Think of Logistics as the "support" section – they ensure that Operations has everything they need to do their job.`,
  },
  {
    patterns: [/finance section/i, /finance chief/i, /fsc/i, /cost/i, /documentation.*cost/i],
    response: `**Finance/Administration Section** manages all financial and administrative aspects:

- **Chief:** Finance/Administration Section Chief (FSC)
- **Responsibilities:**
  - Tracking all incident costs
  - Documenting for FEMA reimbursement
  - Processing personnel time records
  - Managing contracts and purchases
  - Workers' compensation claims
- **Units include:** Time, Procurement, Compensation/Claims, Cost

Proper financial documentation during an incident can enable significant reimbursement from FEMA and other sources.`,
  },
  {
    patterns: [/mci/i, /mass casualty/i, /multiple casualty/i],
    response: `**Mass Casualty Incident (MCI)** is an event producing more patients than can be managed with routine resources.

**Key MCI Concepts:**
- **START Triage:** Simple Triage and Rapid Treatment
  - **RED** - Immediate (life-threatening, survivable)
  - **YELLOW** - Delayed (serious, not immediately life-threatening)
  - **GREEN** - Minor ("walking wounded")
  - **BLACK** - Expectant/Deceased

**MCI Principles:**
- Greatest good for greatest number
- Surge capacity activation
- Family Assistance Center
- Regional hospital coordination

**HICS Activation:** Full HICS activation is typical for large MCI events.`,
  },
  {
    patterns: [/start triage/i, /triage/i, /red tag/i, /yellow tag/i, /green tag/i, /black tag/i],
    response: `**START Triage (Simple Triage and Rapid Treatment)**

Assess patients in 30 seconds or less using three checks:

1. **Respirations** – Can they breathe? If not breathing after repositioning airway → BLACK
2. **Perfusion** – Check radial pulse or capillary refill (<2 sec normal)
3. **Mental Status** – Can they follow simple commands?

**Color Categories:**
| Color | Meaning | Criteria |
|-------|---------|----------|
| RED | Immediate | Resp. 10-30/min OR poor perfusion OR altered mental status |
| YELLOW | Delayed | Breathing, adequate perfusion, follows commands but can't walk |
| GREEN | Minor | Walking wounded |
| BLACK | Expectant | No respirations after airway opening, or clearly fatal injuries |`,
  },
  {
    patterns: [/fire/i, /race/i, /pass/i, /evacuation/i, /fire extinguisher/i],
    response: `**Hospital Fire Response**

**RACE Protocol:**
- **R**escue – Rescue anyone in immediate danger
- **A**larm – Pull alarm and call 911
- **C**onfine – Close all doors to contain fire
- **E**xtinguish/Evacuate – Extinguish if small and safe, or evacuate

**PASS (Fire Extinguisher Use):**
- **P**ull the pin
- **A**im at the base of the fire
- **S**queeze the handle
- **S**weep from side to side

**Evacuation Types (in order of preference):**
1. **Horizontal** – Move to another zone on same floor
2. **Vertical** – Move to floor above or below
3. **External** – Move outside the building

Never use elevators during a fire evacuation!`,
  },
  {
    patterns: [/hazmat/i, /hazardous material/i, /chemical/i, /decontamination/i, /decon/i],
    response: `**HazMat Response in Healthcare**

**Key Principle:** Prevent secondary contamination!

**Zones:**
- **Hot Zone** - Area of contamination (HazMat team only)
- **Warm Zone** - Decontamination area (trained staff with PPE)
- **Cold Zone** - Clean area for medical treatment

**Decontamination Process:**
1. Stop patients BEFORE entering the facility
2. Remove clothing (removes ~80% of contamination)
3. Soap and water wash (removes ~99% of contamination)
4. Rinse thoroughly
5. Provide gowns/blankets
6. Move to cold zone for medical treatment

**Unknown Chemical:** Treat with soap and water until chemical is identified. Consult CHEMTREC (1-800-424-9300) or Poison Control.`,
  },
  {
    patterns: [/hipaa/i, /privacy/i, /patient information/i, /patient records/i],
    response: `**HIPAA During Emergencies**

HIPAA is **NOT** suspended during emergencies, but specific provisions allow:

**Allowed disclosures:**
- To public health authorities responding to the emergency
- To first responders who need information to provide care
- To family members directly involved in patient care (with patient permission or if patient is incapacitated)
- To notify family of patient location/status (general condition only)

**Never allowed:**
- Publishing patient lists publicly
- Giving patient names to media
- Posting information on social media
- Sharing with non-treatment agencies without authorization

**HIPAA Emergency Provisions (45 CFR §164.512):** During a federal or state declared emergency, some HIPAA waiver provisions may apply - check with your Privacy Officer.`,
  },
  {
    patterns: [/iap/i, /incident action plan/i, /planning cycle/i],
    response: `**Incident Action Plan (IAP)**

The IAP is the master document for each operational period (typically 8-12 hours).

**IAP Sections:**
1. **Incident Objectives** – What we need to accomplish
2. **Incident Organization Chart** – Who is in charge of what
3. **Assignment List** – Specific tasks for each section
4. **Communication Plan** – Radio/phone frequencies and contacts
5. **Medical Plan** – Staff health and safety
6. **Traffic Plan** – Vehicle routing

**Planning Cycle:**
1. Incident briefing
2. Develop objectives
3. Tactics meeting
4. IAP preparation
5. Operational period briefing
6. Execute IAP
7. Repeat for next period`,
  },
  {
    patterns: [/span of control/i, /how many people/i, /supervisor ratio/i],
    response: `**Span of Control in HICS/ICS**

The recommended span of control is **1 supervisor to 3-7 subordinates**, with **5 being optimal**.

Why this matters:
- Too many direct reports = supervisor is overwhelmed
- Too few direct reports = inefficient use of supervisors
- During emergencies, maintaining span of control is critical for effective oversight

If a section has too many personnel, **Branch Directors** or **Group Supervisors** can be added to maintain the 1:5 ratio.`,
  },
  {
    patterns: [/after action/i, /hot wash/i, /debriefing/i, /lessons learned/i, /cisd/i, /critical incident stress/i],
    response: `**After-Action Review (AAR) & Debriefing**

**Hot Wash (Immediate Debrief):**
- Within 1 hour of incident end
- Brief operational review of what happened
- Identify immediate issues

**After-Action Review (AAR):**
- Within 2 weeks of incident
- Full review of objectives vs. outcomes
- Identify strengths and areas for improvement
- Creates corrective action plan

**Critical Incident Stress Debriefing (CISD):**
- Peer support process for psychological recovery
- Addresses trauma, stress, and moral injury
- Should be offered to all staff involved
- Signs of stress: nightmares, hypervigilance, difficulty sleeping, emotional numbing

**Key:** Document all lessons learned and track corrective actions to improve future responses.`,
  },
  {
    patterns: [/surge capacity/i, /surge plan/i, /overcapacity/i, /bed capacity/i],
    response: `**Hospital Surge Capacity Strategies**

**Conventional Capacity (Level 1):**
- Routine operations with additional resources
- Cancel elective procedures
- Expedite discharges

**Contingency Capacity (Level 2):**
- Adapted spaces and processes
- Waiting rooms converted to treatment areas
- Extended stay for current patients
- Ambulance diversion if needed

**Crisis Capacity (Level 3):**
- Crisis standards of care implemented
- Non-traditional spaces (cafeteria, hallways)
- Staff reassignment across departments
- Care rationing decisions

**S60/S20 Rule:** Many hospitals aim to create:
- 20% surge beyond licensed bed capacity
- 60% surge with full activation

Regional coordination with nearby hospitals is essential for large-scale surges.`,
  },
  {
    patterns: [/eop/i, /emergency operations plan/i, /emergency plan/i],
    response: `**Emergency Operations Plan (EOP)**

The EOP is the hospital's master emergency planning document that:

- Describes the overall approach to emergency management
- References all emergency procedures and annexes
- Outlines HICS activation criteria
- Identifies community partners and contacts

**Required by:** The Joint Commission (TJC), CMS Conditions of Participation, and OSHA

**EOP Structure:**
1. Basic Plan – Overall emergency management approach
2. Functional Annexes – Communications, evacuation, etc.
3. Hazard-Specific Annexes – Specific procedures for each hazard type
4. Supporting Documents – Resource lists, contact directories

**Review:** Must be reviewed annually and tested with exercises.`,
  },
  {
    patterns: [/nims/i, /national incident management/i, /ics/i, /incident command system/i],
    response: `**NIMS and ICS Relationship to HICS**

**NIMS (National Incident Management System):**
- Framework for government-wide emergency management
- Required for federal funding recipients (including hospitals)
- Provides common terminology, systems, and processes

**ICS (Incident Command System):**
- Operational component of NIMS
- Originally developed for wildfire response
- Now used across all disciplines

**HICS (Hospital Incident Command System):**
- ICS adapted specifically for healthcare settings
- Developed by California hospitals in the 1980s
- Now the national standard for hospital emergency management
- Uses same ICS structure but with healthcare-specific positions and job action sheets

Hospitals receiving federal funding must maintain NIMS compliance, which includes using HICS-compatible systems.`,
  },
  {
    patterns: [/job action sheet/i, /jas/i, /role card/i],
    response: `**Job Action Sheets (JAS)**

A Job Action Sheet is a quick-reference card for each HICS position that includes:

- **Mission statement** for the position
- **Immediate actions** (first 0-2 hours)
- **Intermediate actions** (2-12 hours)
- **Extended actions** (beyond 12 hours)
- **Reporting relationships**
- **Key contacts**

JAS are designed so that any qualified person can pick up a role, even if they've never done it before. They are pre-positioned in the Command Center and should be updated with your hospital's specific information.

**Download free JAS templates:** Available from the California Hospital Association and FEMA.`,
  },
  {
    patterns: [/hello/i, /hi\b/i, /hey/i, /good morning/i, /good afternoon/i, /good evening/i],
    response: `Hello! I'm your HICS Training Assistant. I'm here to help you learn about the Hospital Incident Command System.

You can ask me about:
- **HICS Structure** - Roles, sections, and organizational chart
- **MCI Response** - Mass casualty incidents and START triage
- **Fire Response** - RACE protocol and evacuation procedures
- **HazMat** - Chemical/hazardous material response
- **Documentation** - IAP, AAR, and HICS forms
- **HIPAA** - Patient privacy during emergencies

What would you like to learn about?`,
  },
  {
    patterns: [/help/i, /what can you/i, /topics/i, /what do you know/i],
    response: `I'm your HICS Training Assistant! Here are the topics I can help with:

**HICS Structure:**
- Incident Commander role
- Command Staff (Safety Officer, PIO, Liaison)
- Operations, Planning, Logistics, Finance sections
- Span of control
- Job Action Sheets

**Emergency Scenarios:**
- Mass Casualty Incidents (MCI) and START triage
- Fire response (RACE, PASS, evacuation)
- Hazardous Materials (HazMat)
- Hospital surge capacity

**Planning & Documentation:**
- Incident Action Plan (IAP)
- Emergency Operations Plan (EOP)
- After-Action Reviews
- NIMS/ICS relationship

**Special Topics:**
- HIPAA during emergencies
- Critical Incident Stress Debriefing
- Hospital surge capacity

Just ask a question and I'll do my best to help!`,
  },
  {
    patterns: [/psychiatric|mental health|behavioral health/i, /psychiatric patient|mental health crisis/i],
    response: `**Psychiatric Considerations in HICS**

Healthcare emergencies often involve or affect psychiatric patients. Key principles:

**Patient Safety & Movement:**
- Maintain continuity of psychiatric medications during evacuations and relocations
- Ensure appropriate supervision levels during transfers (1:1 for high-risk patients)
- Brief receiving facilities on psychiatric history and current risk factors

**Staff Training & Readiness:**
- Include psychiatric staff in incident simulation planning
- Cross-train non-psychiatric staff on basic de-escalation and behavioral observation
- Recognize that psychiatric patients may exhibit altered communication during stress

**Integration with HICS:**
- Include psychiatric leadership in command planning for incident-related mental health surge
- Coordinate psychological first aid for both patients and staff
- Plan for crisis psychiatric interventions alongside medical surge response

**Psychiatric Surge Capacity:**
- Extend observation units; activate crisis respite areas
- Mobilize crisis prevention specialists and peer support specialists
- Coordinate with community psychiatric facilities if transfer is needed`,
  },
  {
    patterns: [/workforce|staffing|fatigue|burnout/i, /staff resilience/i],
    response: `**Workforce Management & Staff Resilience**

During extended incidents, staff fatigue and psychological strain can impact safety and care quality.

**Shift Management:**
- Limit shifts to 8-12 hours during full HICS activation
- Provide 6-8 hour recovery periods before redeployment
- Rotate high-stress roles (like ED triage) to prevent individual burnout

**Basic Needs Support:**
- Ensure adequate food, water, rest areas, and restroom facilities
- Provide hand hygiene and comfort supplies to reduce disease transmission and stress
- Consider on-site childcare for staff with children during extended incidents

**Psychological Support:**
- Establish staff briefing areas for Information Officer updates and morale
- Deploy peer support specialists and employee assistance representatives
- Conduct brief mental health check-ins for debrief and early identification of trauma responses

**Recognition & Thank You:**
- Acknowledge staff contributions formally during and after incidents
- Document heroic or exemplary actions for recognition programs
- Plan small celebrations (pizza, coffee) when operationally safe`,
  },
  {
    patterns: [/family assistance|missing persons|family center/i],
    response: `**Family Assistance Centers & Victim Support**

When hospital incidents affect multiple patients/families, organized family services are essential.

**Family Assistance Center Setup:**
- Establish a separate, quiet location with adequate seating, restrooms, and phones
- Provide comfort items: water, tissues, chairs, minimal privacy screens
- Staffed by trained counselors, case managers, and bilingual support if available

**Information Management:**
- Develop standardized intake forms to track who is seeking what information
- Use unambiguous identification processes (ID photos, descriptions) to match families with patients
- Provide regular updates on processing status, even if status hasn't changed

**Support Services:**
- Offer immediate counseling and support groups for traumatized families
- Connect families with financial assistance, insurance, and legal support information
- Provide identification and disposition information for deaths with respect and compassion

**Cultural Sensitivity:**
- Include chaplains and cultural leaders from major religions/traditions
- Respect family decision-making around religious practices and rituals
- Avoid making assumptions about family structure or communication preferences`,
  },
  {
    patterns: [/documentation|recording|evidence|chain of custody/i],
    response: `**Incident Documentation & Evidence Preservation**

Proper documentation during and after incidents ensures legal accountability, quality improvement, and appropriate reimbursement.

**What to Document:**
- Time, description, and personnel involved in significant events (injuries, security incidents, deaths)
- Resource requests, acquisitions, and usage (supplies, staff hours, equipment)
- Decisions made and the facts/reasoning that informed them (IAP sections, allocation decisions)
- Photos/video of damage, setup, or operational areas (per institutional policy)

**Chain of Custody Principles:**
- If evidence is collected (suspicious items, weapons, etc.), maintain a clear record of who handled it and when
- Separate from routine clinical documentation if law enforcement is involved
- Notify security/legal immediately for incidents involving criminal elements

**Incident-Specific Records:**
- Maintain hospitalization records as normal, including incident context
- Create summary "incident narratives" for key decisions (e.g., deactivation reason, final resource count)
- Preserve copies of all IAPs, huddle notes, and communications logs

**FEMA/Reimbursement Documentation:**
- Track all overtime, supply purchases, and equipment costs by category
- Keep receipts and vendor contact information for large purchases
- Document donated resources separately from purchased resources
- Include volunteer hours and mutual aid contributions

**Legal Considerations:**
- Consult your hospital attorney before releasing records to media or public
- Be aware that incident documentation may be subject to discovery in litigation
- Balance transparency with legal privilege protection`,
  },
  {
    patterns: [/exercise|simulation|drill|tabletop|training/i],
    response: `**Incident Response Exercises & Training**

Regular exercises, simulations, and drills are essential for maintaining HICS readiness and identifying gaps.

**Types of Exercises:**

1. **Tabletop Exercise** – Discussion-based; command staff discuss scenario and decisions. Low cost, high learning.
2. **Functional Exercise** – Tests specific functions (EOC activation, communication system launch). Moderate cost and complexity.
3. **Full-Scale Exercise** – Simulates actual incident with realistic props, actors, and operational testing. High cost but most effective.
4. **Drill** – Tests one specific skill or system (fire evacuation, lockdown procedures). Frequent, low-cost practice.

**Scheduling & Frequency:**
- Full-scale exercise: At least annually
- Functional exercises: 2-4 annually targeting specific gaps
- Tabletop/drills: Monthly during formal training season

**After-Exercise Evaluation:**
- Conduct hot wash (immediate debrief) while details are fresh
- Issue formal AAR with strengths, gaps, and corrective actions
- Track improvement over successive exercises

**Cross-Training & Confidence:**
- Use exercises to cross-train staff in backup roles
- Document proficiency achieved during successful drills
- Build staff confidence that HICS activation is doable and practices are realistic

**Records Retention:**
- Keep exercise plans, scenarios, and evaluation reports as reference materials
- Track which personnel have participated in exercises for training documentation`,
  },
];


export function getBotResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase().trim();

  for (const entry of knowledgeBase) {
    for (const pattern of entry.patterns) {
      if (pattern.test(lowerMessage)) {
        return entry.response;
      }
    }
  }

  // Default response for unrecognized queries
  return `I don't have specific information about "${userMessage}" in my knowledge base.

Try asking about:
- HICS structure and roles (Incident Commander, Operations, Planning, Logistics, Finance)
- Emergency scenarios (MCI, fire, hazmat)
- Triage (START triage system)
- Documentation (IAP, AAR, EOP)
- HIPAA during emergencies

You can also type "help" to see all available topics.`;
}

export function getInitialMessage(): ChatMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    content: `Welcome to the HICS Training Assistant.

I'm here to help you learn about the **Hospital Incident Command System (HICS)** - the emergency management framework used by hospitals across the United States.

You can ask me about:
- HICS roles and organizational structure
- Mass casualty incident (MCI) response
- Fire safety protocols (RACE, PASS)
- Hazardous materials response
- Patient surge capacity strategies
- HIPAA during emergencies

**Try asking:** "What is HICS?" or "How does START triage work?" or type "help" for more topics.`,
    timestamp: new Date(),
  };
}
