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
