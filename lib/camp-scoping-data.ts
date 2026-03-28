// ==================== CAMP BOE MOCK DATA ====================
// 
// This file contains WBS elements for the CAMP (Consular Appointment Management Program)
// solicitation 19AQMM25Q0273, structured for BOE documentation.
//
// Team Composition (Base Year - 14.5 FTE):
// - Delivery Manager (1.0 FTE, 1,920 hrs)
// - Product Manager (1.0 FTE, 1,920 hrs)
// - Design Lead (1.0 FTE, 1,920 hrs)
// - Product Designer (1.0 FTE, 1,920 hrs)
// - UX Researcher (1.0 FTE, 1,920 hrs)
// - DoS SME (0.5 FTE, 960 hrs)
// - Service Designer (1.0 FTE, 1,920 hrs)
// - IT Training Specialist (1.0 FTE, 1,920 hrs)
// - Technical Lead (1.0 FTE, 1,920 hrs)
// - Frontend Engineer x2 (2.0 FTE, 3,840 hrs)
// - Backend Engineer x2 (2.0 FTE, 3,840 hrs)
// - DevOps Engineer (1.0 FTE, 1,920 hrs)
// - QA Engineer (1.0 FTE, 1,920 hrs)
//
// Option Years 1 & 2 Changes:
// - Remove DoS SME (transition complete)
// - Add 1 additional Backend Engineer (3x total)
//
// ==================== IMPORTS ====================

import { WBSElement, EstimateData } from '@/contexts/app-context';

// ==================== HELPER: Generate unique IDs ====================

const generateId = () => `wbs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// ==================== CAMP SOLICITATION INFO ====================

export const campSolicitationInfo = {
  solicitationNumber: '19AQMM25Q0273',
  title: 'Consular Appointment Management Program (CAMP)',
  clientAgency: 'State',
  subAgency: 'Bureau of Consular Affairs (CA)',
  contractType: 'T&M' as const,
  periodOfPerformance: {
    baseYear: true,
    optionYears: 2,
  },
  // 26 two-week sprints per year
  sprintsPerYear: 26,
  hoursPerFtePerYear: 1920,
  hoursPerFtePerSprint: 74, // 1920 / 26 ≈ 74
};

// ==================== TEAM COMPOSITION ====================

export const campTeamComposition = {
  baseYear: [
    { roleId: 'dm', roleName: 'Delivery Manager', fte: 1.0, hours: 1920 },
    { roleId: 'pm', roleName: 'Product Manager', fte: 1.0, hours: 1920 },
    { roleId: 'dl', roleName: 'Design Lead', fte: 1.0, hours: 1920 },
    { roleId: 'pd', roleName: 'Product Designer', fte: 1.0, hours: 1920 },
    { roleId: 'uxr', roleName: 'UX Researcher', fte: 1.0, hours: 1920 },
    { roleId: 'sme', roleName: 'DoS Subject Matter Expert', fte: 0.5, hours: 960 },
    { roleId: 'sd', roleName: 'Service Designer', fte: 1.0, hours: 1920 },
    { roleId: 'itt', roleName: 'IT Training Specialist', fte: 1.0, hours: 1920 },
    { roleId: 'tl', roleName: 'Technical Lead', fte: 1.0, hours: 1920 },
    { roleId: 'fe', roleName: 'Frontend Engineer', fte: 2.0, hours: 3840 },
    { roleId: 'be', roleName: 'Backend Engineer', fte: 2.0, hours: 3840 },
    { roleId: 'devops', roleName: 'DevOps Engineer', fte: 1.0, hours: 1920 },
    { roleId: 'qa', roleName: 'QA Engineer', fte: 1.0, hours: 1920 },
  ],
  optionYears: [
    { roleId: 'dm', roleName: 'Delivery Manager', fte: 1.0, hours: 1920 },
    { roleId: 'pm', roleName: 'Product Manager', fte: 1.0, hours: 1920 },
    { roleId: 'dl', roleName: 'Design Lead', fte: 1.0, hours: 1920 },
    { roleId: 'pd', roleName: 'Product Designer', fte: 1.0, hours: 1920 },
    { roleId: 'uxr', roleName: 'UX Researcher', fte: 1.0, hours: 1920 },
    // SME removed - transition complete
    { roleId: 'sd', roleName: 'Service Designer', fte: 1.0, hours: 1920 },
    { roleId: 'itt', roleName: 'IT Training Specialist', fte: 1.0, hours: 1920 },
    { roleId: 'tl', roleName: 'Technical Lead', fte: 1.0, hours: 1920 },
    { roleId: 'fe', roleName: 'Frontend Engineer', fte: 2.0, hours: 3840 },
    { roleId: 'be', roleName: 'Backend Engineer', fte: 3.0, hours: 5760 }, // 3x in option years
    { roleId: 'devops', roleName: 'DevOps Engineer', fte: 1.0, hours: 1920 },
    { roleId: 'qa', roleName: 'QA Engineer', fte: 1.0, hours: 1920 },
  ],
};

// ==================== WBS ELEMENTS ====================
// Organized by major deliverable area, with labor estimates per role

export const campWBSElements: WBSElement[] = [
  // ==================== 1.0 PROGRAM MANAGEMENT ====================
  {
    id: generateId(),
    wbsNumber: '1.1',
    title: 'Program Management & Agile Delivery',
    
    // Header
    sowReference: 'SOO Section 3.1, 4.1; "Agile development process with typical agile ceremonies" (p.9)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-01-01',
      end: '2025-12-31',
    },
    
    // Task Description
    why: 'Provide continuous program oversight to ensure on-time, on-budget delivery of CAMP capabilities while maintaining alignment with CA stakeholder priorities and federal compliance requirements.',
    what: 'Sprint planning, daily standups, sprint reviews, retrospectives across 26 two-week sprints. Weekly status meetings with federal Product Owner. Monthly Contract Status Reports. Risk identification and mitigation tracking. Resource management including clearance tracking and capacity planning.',
    notIncluded: 'Government contracting officer responsibilities. Procurement of additional resources beyond approved team. Policy decisions requiring federal authority.',
    assumptions: [
      'Federal Product Owner available for weekly sync meetings',
      'Access to incumbent documentation within 30 days of contract start',
      'Stable team composition throughout base year',
    ],
    dependencies: [
      'Government-furnished equipment and badge access',
      'BESPIN environment access credentials',
    ],
    
    // Basis of Estimate
    estimateMethod: 'historical',
    historicalReference: {
      programName: 'USCIS MyAccount Modernization',
      chargeNumber: 'USCIS-2024-PM-0342',
      actualHours: 580,
      taskDescription: 'Program management for 12-person agile team, 24 sprints, similar federal HCD contract',
    },
    complexityFactor: 1.03,
    complexityJustification: 'Slightly higher complexity due to global stakeholder coordination across 300+ posts and multiple time zones. USCIS was primarily domestic.',
    
    // Labor Estimates
    laborEstimates: [
      {
        id: 'labor-dm-pm',
        roleId: 'dm',
        roleName: 'Delivery Manager',
        baseHours: 580,
        complexityFactor: 1.03,
        calculatedHours: 597,
        rationale: 'Based on USCIS-2024-PM-0342 actual hours (580) with 3% complexity adjustment for global coordination',
      },
    ],
    totalHours: 597,
    
    // Quality (will be recalculated)
    qualityGrade: 'green',
    qualityIssues: [],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  
  {
    id: generateId(),
    wbsNumber: '1.2',
    title: 'Transition-In & Knowledge Transfer',
    
    sowReference: 'SOO Section 6.1; "Transition-In Plan" deliverable (p.21)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-01-01',
      end: '2025-03-31',
    },
    
    why: 'Enable seamless takeover from incumbent contractor while minimizing disruption to ongoing CAMP operations and maintaining continuity of service for 300+ consular posts.',
    what: 'Review incumbent documentation and codebase. Shadow incumbent team during overlap period. Document tribal knowledge and undocumented processes. Obtain environment access and credentials. Complete security onboarding. Establish communication channels with CA stakeholders.',
    notIncluded: 'Remediation of incumbent technical debt (separate WBS). Re-architecture decisions (addressed in technical planning).',
    assumptions: [
      '30-day overlap period with incumbent team',
      'Incumbent provides complete system documentation',
      'All team members have Secret clearance at contract start',
    ],
    dependencies: [
      'Incumbent cooperation per transition clause',
      'Government-facilitated introductions to key stakeholders',
    ],
    
    estimateMethod: 'historical',
    historicalReference: {
      programName: 'DOS Travel Portal Transition',
      chargeNumber: 'DOS-TP-2023-TRANS-088',
      actualHours: 420,
      taskDescription: 'Transition-in for DOS cloud application, similar team size and tech stack',
    },
    complexityFactor: 1.15,
    complexityJustification: '15% increase due to three legacy systems to understand (vs. single system in reference) and globally distributed post configurations.',
    
    laborEstimates: [
      {
        id: 'labor-dm-trans',
        roleId: 'dm',
        roleName: 'Delivery Manager',
        baseHours: 175,
        complexityFactor: 1.15,
        calculatedHours: 201,
        rationale: 'Coordinate transition activities, establish stakeholder relationships, oversee knowledge capture',
      },
      {
        id: 'labor-tl-trans',
        roleId: 'tl',
        roleName: 'Technical Lead',
        baseHours: 130,
        complexityFactor: 1.15,
        calculatedHours: 150,
        rationale: 'Architecture review, codebase assessment, environment access, BESPIN coordination',
      },
      {
        id: 'labor-sme-trans',
        roleId: 'sme',
        roleName: 'DoS Subject Matter Expert',
        baseHours: 65,
        complexityFactor: 1.15,
        calculatedHours: 75,
        rationale: 'Capture consular process knowledge, post-specific configurations, policy context',
      },
      {
        id: 'labor-sd-trans',
        roleId: 'sd',
        roleName: 'Service Designer',
        baseHours: 52,
        complexityFactor: 1.15,
        calculatedHours: 60,
        rationale: 'Document current service blueprints for three legacy scheduling systems',
      },
    ],
    totalHours: 486,
    
    qualityGrade: 'green',
    qualityIssues: [],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== 2.0 PUBLIC SCHEDULING PORTAL ====================
  {
    id: generateId(),
    wbsNumber: '2.1',
    title: 'Public Appointment Booking Flow',
    
    sowReference: 'SOO Section 3.2.1; "Public customers are able to schedule an appointment in less than five minutes" (p.6); "Enhancing the customer experience for ACS scheduling" (p.5)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-01-01',
      end: '2025-12-31',
    },
    
    why: 'Deliver a streamlined, accessible appointment booking experience that enables citizens abroad to schedule consular appointments in under 5 minutes, meeting the SOO performance requirement while supporting multiple languages and accessibility standards.',
    what: 'Design and develop complete public-facing booking flow including: appointment type selection, post/location search, date/time slot selection, applicant information collection, fee payment via Pay.gov integration, confirmation and calendar integration. Support Spanish and additional languages per post requirements. Ensure 100% Section 508 compliance and 5th grade reading level.',
    notIncluded: 'NIV (visa) scheduling functionality (future scope). Crisis management scheduling (separate WBS). Backend appointment availability algorithms (separate WBS).',
    assumptions: [
      'MVP public booking flow exists and is functional',
      'Pay.gov integration patterns established by incumbent',
      'Post-specific configurations documented',
    ],
    dependencies: [
      'Scheduling API availability (WBS 3.1)',
      'Pay.gov sandbox access for testing',
      'USWDS design system components',
    ],
    
    estimateMethod: 'parametric',
    historicalReference: {
      programName: 'FFTC Internal Productivity Data',
      chargeNumber: 'FFTC-PROD-2024-UI',
      actualHours: 40, // hours per major user flow
      taskDescription: 'Average 40 hours per major user flow for React/USWDS federal applications based on 12 past projects',
    },
    complexityFactor: 1.2,
    complexityJustification: '20% increase for i18n requirements (multi-language), strict 508 compliance with screen reader testing, and 5-minute completion SLA requiring performance optimization.',
    
    laborEstimates: [
      {
        id: 'labor-pd-booking',
        roleId: 'pd',
        roleName: 'Product Designer',
        baseHours: 333,
        complexityFactor: 1.2,
        calculatedHours: 400,
        rationale: '8 major screens × 40 hrs/screen base = 320 hrs. 1.2x for i18n mockups and 508 annotation. Includes: type selection, post search, calendar, forms, payment, confirmation, error states, mobile responsive.',
      },
      {
        id: 'labor-uxr-booking',
        roleId: 'uxr',
        roleName: 'UX Researcher',
        baseHours: 250,
        complexityFactor: 1.2,
        calculatedHours: 300,
        rationale: 'Usability testing across 6 sprints (50 hrs/sprint for recruitment, testing, synthesis). Includes diverse user recruitment globally and accessibility testing with assistive tech.',
      },
      {
        id: 'labor-fe-booking',
        roleId: 'fe',
        roleName: 'Frontend Engineer',
        baseHours: 583,
        complexityFactor: 1.2,
        calculatedHours: 700,
        rationale: 'React implementation of 8 flows at 60 hrs/flow base = 480 hrs. 1.2x for i18n framework, RTL support, 508 compliance, Pay.gov integration UI, performance optimization.',
      },
      {
        id: 'labor-qa-booking',
        roleId: 'qa',
        roleName: 'QA Engineer',
        baseHours: 167,
        complexityFactor: 1.2,
        calculatedHours: 200,
        rationale: 'Functional testing, cross-browser matrix, mobile device testing, 508 automated + manual testing, multi-language verification.',
      },
    ],
    totalHours: 1600,
    
    qualityGrade: 'green',
    qualityIssues: [],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== 3.0 ADMIN PORTAL ====================
  {
    id: generateId(),
    wbsNumber: '3.1',
    title: 'Admin Calendar & Capacity Management',
    
    sowReference: 'SOO Section 3.2.2; "Visually allocate appointment categories slots to timeslots on a calendar view" (p.15); "Efficiently open up and manage appointment slots" (p.6); "Consular-facing resource and capacity scheduling" (p.5)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-01-01',
      end: '2025-12-31',
    },
    
    why: 'Enable consular staff to efficiently manage appointment capacity across multiple service types, windows, and officers, reducing administrative burden and ensuring optimal resource utilization at 300+ posts worldwide.',
    what: 'Design and develop admin calendar interface with: visual slot allocation by appointment type, bulk operations for opening/closing slots, recurring schedule templates, officer/window assignment, capacity analytics dashboard, real-time availability updates. Support LE staff and cleared American user roles with appropriate permissions.',
    notIncluded: 'Reports dashboard (separate WBS). Post configuration wizard (separate WBS). Fraud detection views (separate WBS).',
    assumptions: [
      'Admin portal MVP exists with basic calendar functionality',
      'OKTA SSO integration established for admin authentication',
      'Post-specific business rules documented',
    ],
    dependencies: [
      'Admin API endpoints (WBS 3.2)',
      'OKTA authentication configuration',
      'BESPIN hosting environment',
    ],
    
    estimateMethod: 'historical',
    historicalReference: {
      programName: 'VA Appointment Scheduling Admin',
      chargeNumber: 'VA-SCHED-2023-ADMIN-156',
      actualHours: 1800,
      taskDescription: 'Admin calendar and capacity management for VA healthcare scheduling, similar complexity and user base',
    },
    complexityFactor: 1.1,
    complexityJustification: '10% increase for multi-post configuration complexity (300+ posts with varying rules vs. VA regional model) and real-time global synchronization requirements.',
    
    laborEstimates: [
      {
        id: 'labor-pm-admin',
        roleId: 'pm',
        roleName: 'Product Manager',
        baseHours: 182,
        complexityFactor: 1.1,
        calculatedHours: 200,
        rationale: 'Requirements definition, stakeholder alignment, acceptance criteria for complex calendar interactions and bulk operations.',
      },
      {
        id: 'labor-pd-admin',
        roleId: 'pd',
        roleName: 'Product Designer',
        baseHours: 364,
        complexityFactor: 1.1,
        calculatedHours: 400,
        rationale: 'Calendar UI design (most complex component), bulk operation flows, template management, responsive tablet design for admin use.',
      },
      {
        id: 'labor-fe-admin',
        roleId: 'fe',
        roleName: 'Frontend Engineer',
        baseHours: 636,
        complexityFactor: 1.1,
        calculatedHours: 700,
        rationale: 'Complex calendar component with drag-drop, bulk selection, real-time updates. Based on VA reference (650 hrs) with 10% complexity.',
      },
      {
        id: 'labor-be-admin',
        roleId: 'be',
        roleName: 'Backend Engineer',
        baseHours: 545,
        complexityFactor: 1.1,
        calculatedHours: 600,
        rationale: 'Admin API endpoints, bulk operations, template engine, permission management, real-time sync across posts.',
      },
      {
        id: 'labor-qa-admin',
        roleId: 'qa',
        roleName: 'QA Engineer',
        baseHours: 182,
        complexityFactor: 1.1,
        calculatedHours: 200,
        rationale: 'Complex interaction testing, permission matrix validation, bulk operation edge cases, calendar date/time handling.',
      },
    ],
    totalHours: 2100,
    
    qualityGrade: 'green',
    qualityIssues: [],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== 4.0 INTEGRATIONS ====================
  {
    id: generateId(),
    wbsNumber: '4.1',
    title: 'Pay.gov Payment Integration',
    
    sowReference: 'SOO Section 3.3.1; "Pay any fees via Pay.gov" (p.7)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-03-01',
      end: '2025-09-30',
    },
    
    why: 'Enable secure fee collection for consular appointments through the government-mandated Pay.gov payment gateway, ensuring compliance with Treasury requirements and providing reliable payment confirmation flow.',
    what: 'Integrate Pay.gov hosted payment pages into booking flow. Handle payment confirmation callbacks. Support fee refunds and adjustments. Implement payment status tracking and reconciliation. Handle payment failures gracefully with user recovery options.',
    notIncluded: 'Fee structure changes (government policy). Alternative payment methods. Financial reporting (government responsibility).',
    assumptions: [
      'Pay.gov API access and sandbox credentials provided',
      'Fee schedules provided by CA',
      'Incumbent integration patterns documented',
    ],
    dependencies: [
      'Pay.gov agency enrollment complete',
      'Treasury sandbox environment access',
    ],
    
    estimateMethod: 'historical',
    historicalReference: {
      programName: 'USCIS Online Payment Integration',
      chargeNumber: 'USCIS-2023-PAY-067',
      actualHours: 280,
      taskDescription: 'Pay.gov integration for USCIS form filing payments, similar flow and requirements',
    },
    complexityFactor: 1.0,
    complexityJustification: 'Standard Pay.gov integration pattern matches reference implementation. No significant complexity differences.',
    
    laborEstimates: [
      {
        id: 'labor-be-pay',
        roleId: 'be',
        roleName: 'Backend Engineer',
        baseHours: 200,
        complexityFactor: 1.0,
        calculatedHours: 200,
        rationale: 'API integration, callback handling, status tracking, refund logic based on USCIS-2023-PAY-067 reference.',
      },
      {
        id: 'labor-fe-pay',
        roleId: 'fe',
        roleName: 'Frontend Engineer',
        baseHours: 50,
        complexityFactor: 1.0,
        calculatedHours: 50,
        rationale: 'Payment UI flow, hosted page redirect, confirmation display, error handling.',
      },
      {
        id: 'labor-qa-pay',
        roleId: 'qa',
        roleName: 'QA Engineer',
        baseHours: 30,
        complexityFactor: 1.0,
        calculatedHours: 30,
        rationale: 'Payment flow testing, sandbox validation, error scenario testing.',
      },
    ],
    totalHours: 280,
    
    qualityGrade: 'blue', // Excellent - strong historical reference with exact match
    qualityIssues: [],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  {
    id: generateId(),
    wbsNumber: '4.2',
    title: 'DS-160/CEAC Validation Integration',
    
    sowReference: 'SOO Section 3.3.2; "Validate an applicant has a valid DS-160" (p.15); "Integration with eCRBA" (p.15)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-04-01',
      end: '2025-10-31',
    },
    
    why: 'Validate applicant eligibility during booking by verifying DS-160 application status through CEAC integration, preventing invalid appointments and reducing consular staff workload for ineligible applicants.',
    what: 'Implement barcode scanning/entry for DS-160 confirmation. Call CEAC validation API. Handle validation responses and display appropriate messages. Support eCRBA integration for passport renewal eligibility. Cache validation results appropriately.',
    notIncluded: 'DS-160 form processing (separate system). CEAC system maintenance (government owned). Visa adjudication logic.',
    assumptions: [
      'CEAC API specifications documented',
      'eCRBA API access approved',
      'Incumbent integration patterns available',
    ],
    dependencies: [
      'CEAC system availability',
      'eCRBA API credentials',
      'Network connectivity to State Department systems',
    ],
    
    estimateMethod: 'historical',
    historicalReference: {
      programName: 'DOS Visa Status Check',
      chargeNumber: 'DOS-VISA-2022-INT-034',
      actualHours: 350,
      taskDescription: 'CEAC integration for visa status verification, similar API patterns',
    },
    complexityFactor: 1.15,
    complexityJustification: '15% increase for dual integration (CEAC + eCRBA) vs. single system in reference. Additional complexity for barcode scanning implementation.',
    
    laborEstimates: [
      {
        id: 'labor-be-ceac',
        roleId: 'be',
        roleName: 'Backend Engineer',
        baseHours: 261,
        complexityFactor: 1.15,
        calculatedHours: 300,
        rationale: 'CEAC API integration, eCRBA API integration, validation logic, caching strategy.',
      },
      {
        id: 'labor-fe-ceac',
        roleId: 'fe',
        roleName: 'Frontend Engineer',
        baseHours: 70,
        complexityFactor: 1.15,
        calculatedHours: 80,
        rationale: 'Barcode input UI, validation status display, error handling.',
      },
      {
        id: 'labor-qa-ceac',
        roleId: 'qa',
        roleName: 'QA Engineer',
        baseHours: 35,
        complexityFactor: 1.15,
        calculatedHours: 40,
        rationale: 'Integration testing, validation scenario coverage, error handling verification.',
      },
    ],
    totalHours: 420,
    
    qualityGrade: 'green',
    qualityIssues: [],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== 5.0 INFRASTRUCTURE & DEVOPS ====================
  {
    id: generateId(),
    wbsNumber: '5.1',
    title: 'BESPIN Platform Integration & CI/CD',
    
    sowReference: 'SOO Section 4.2; "Tenant of BESPIN" (p.13); "Drone...GitOps" (p.12); "Deployments to production at least once every sprint" (p.9)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-01-01',
      end: '2025-12-31',
    },
    
    why: 'Establish robust CI/CD pipeline on BESPIN platform to enable continuous delivery with automated testing, security scanning, and zero-downtime deployments meeting the SOO requirement of production releases every sprint.',
    what: 'Configure Drone CI pipelines. Implement GitOps deployment patterns. Set up Terraform infrastructure as code. Configure development, testing, staging, and production environments. Implement automated security scanning (SAST). Set up monitoring and alerting via CloudWatch. Support ATO documentation requirements.',
    notIncluded: 'BESPIN platform administration (government responsibility). FedRAMP authorization (platform level). Network security configuration (BESPIN managed).',
    assumptions: [
      'BESPIN tenant provisioned at contract start',
      'Existing CI/CD patterns from incumbent documented',
      'Team has appropriate BESPIN access levels',
    ],
    dependencies: [
      'BESPIN platform access',
      'Git repository provisioning',
      'Security scanning tool licenses',
    ],
    
    estimateMethod: 'historical',
    historicalReference: {
      programName: 'DOS Cloud Migration DevOps',
      chargeNumber: 'DOS-CLOUD-2023-DEVOPS-112',
      actualHours: 1600,
      taskDescription: 'DevOps setup and maintenance for DOS cloud application on BESPIN, 12-month engagement',
    },
    complexityFactor: 0.9,
    complexityJustification: '10% reduction - incumbent has established patterns we can adopt. DOS-CLOUD reference was greenfield; this is enhancement of existing pipeline.',
    
    laborEstimates: [
      {
        id: 'labor-devops-bespin',
        roleId: 'devops',
        roleName: 'DevOps Engineer',
        baseHours: 1511,
        complexityFactor: 0.9,
        calculatedHours: 1360,
        rationale: 'Pipeline setup (200 hrs), BESPIN coordination (200 hrs), monitoring (250 hrs), IaC maintenance (200 hrs), deployment automation (200 hrs), security scanning (150 hrs), environment management (100 hrs), ATO support (60 hrs). 10% reduction for existing patterns.',
      },
      {
        id: 'labor-tl-bespin',
        roleId: 'tl',
        roleName: 'Technical Lead',
        baseHours: 111,
        complexityFactor: 0.9,
        calculatedHours: 100,
        rationale: 'Architecture oversight, BESPIN coordination, security review guidance.',
      },
    ],
    totalHours: 1460,
    
    qualityGrade: 'green',
    qualityIssues: [],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== 6.0 POST ROLLOUT & TRAINING ====================
  {
    id: generateId(),
    wbsNumber: '6.1',
    title: 'Post Onboarding & Rollout Support',
    
    sowReference: 'SOO Section 5.1; "Rollout CAMP to posts overseas" (p.11); "Provide onboarding support to posts" (p.11)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-04-01',
      end: '2025-12-31',
    },
    
    why: 'Successfully transition 50+ consular posts from legacy scheduling systems to CAMP in Base Year, ensuring minimal disruption to appointment services and high user adoption through tailored onboarding support.',
    what: 'Develop post onboarding playbook. Create post-specific configuration guides. Conduct virtual onboarding sessions for post staff. Provide go-live support during transition. Collect and incorporate post feedback. Track adoption metrics and address barriers.',
    notIncluded: 'In-person travel to posts (separate ODC). Legacy system decommissioning (government decision). Post-specific policy changes.',
    assumptions: [
      'Approximately 50 posts targeted for Base Year rollout',
      'Posts have adequate bandwidth for virtual training',
      'Post leadership committed to transition',
    ],
    dependencies: [
      'Core CAMP functionality stable (WBS 2.1, 3.1)',
      'Training materials complete (WBS 6.2)',
      'CA coordination for post scheduling',
    ],
    
    estimateMethod: 'parametric',
    historicalReference: {
      programName: 'FFTC Rollout Productivity Data',
      chargeNumber: 'FFTC-PROD-2024-ROLL',
      actualHours: 16,
      taskDescription: 'Average 16 hours per site rollout for federal SaaS implementations based on 8 past projects',
    },
    complexityFactor: 1.25,
    complexityJustification: '25% increase for global distribution (time zones, language barriers), legacy system variation (3 different systems), and virtual-only delivery constraints.',
    
    laborEstimates: [
      {
        id: 'labor-dm-rollout',
        roleId: 'dm',
        roleName: 'Delivery Manager',
        baseHours: 240,
        complexityFactor: 1.25,
        calculatedHours: 300,
        rationale: 'Rollout scheduling and coordination for 50 posts. 4 hrs/post base × 50 posts = 200 hrs, with 1.25x complexity.',
      },
      {
        id: 'labor-sd-rollout',
        roleId: 'sd',
        roleName: 'Service Designer',
        baseHours: 240,
        complexityFactor: 1.25,
        calculatedHours: 300,
        rationale: 'Onboarding journey design, post-specific customization, feedback incorporation.',
      },
      {
        id: 'labor-itt-rollout',
        roleId: 'itt',
        roleName: 'IT Training Specialist',
        baseHours: 480,
        complexityFactor: 1.25,
        calculatedHours: 600,
        rationale: 'Conduct virtual onboarding for 50 posts. 8 hrs/post base (prep + delivery + follow-up) × 50 = 400 hrs, with 1.25x for global complexity.',
      },
      {
        id: 'labor-sme-rollout',
        roleId: 'sme',
        roleName: 'DoS Subject Matter Expert',
        baseHours: 200,
        complexityFactor: 1.25,
        calculatedHours: 250,
        rationale: 'Post-specific consular process guidance, legacy system knowledge, stakeholder liaison.',
      },
    ],
    totalHours: 1450,
    
    qualityGrade: 'green',
    qualityIssues: [],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  {
    id: generateId(),
    wbsNumber: '6.2',
    title: 'Training Materials Development',
    
    sowReference: 'SOO Section 5.2; "Work with Training team to produce training materials (webinars, user guides, etc.)" (p.11); "Provider user training, documentation, websites, and videos" (p.9)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-02-01',
      end: '2025-08-31',
    },
    
    why: 'Create comprehensive, accessible training materials that enable self-service learning for 10,000+ users globally, reducing support burden and accelerating adoption across consular posts.',
    what: 'Develop video tutorials for key workflows. Create user guides in multiple formats (PDF, web). Build interactive webinars for admin users. Design quick reference job aids. Implement in-app contextual help. Maintain materials as features evolve.',
    notIncluded: 'Translation to non-English languages (separate task). LMS platform hosting (government provided). Mandatory compliance training content.',
    assumptions: [
      'Government provides LMS access for hosting',
      'Video recording/editing tools available',
      'Feature designs finalized before training development',
    ],
    dependencies: [
      'UX designs complete for key workflows',
      'Staging environment available for recording',
    ],
    
    estimateMethod: 'parametric',
    historicalReference: {
      programName: 'FFTC Training Development Data',
      chargeNumber: 'FFTC-PROD-2024-TRAIN',
      actualHours: 20,
      taskDescription: 'Average 20 hours per training module (video + guide + job aid) based on 15 federal projects',
    },
    complexityFactor: 1.1,
    complexityJustification: '10% increase for 508 compliance requirements on all materials and multiple output formats (video, PDF, web).',
    
    laborEstimates: [
      {
        id: 'labor-itt-materials',
        roleId: 'itt',
        roleName: 'IT Training Specialist',
        baseHours: 727,
        complexityFactor: 1.1,
        calculatedHours: 800,
        rationale: 'Develop 36 training modules (12 public user flows, 24 admin functions) × 20 hrs/module base = 720 hrs, with 1.1x complexity.',
      },
      {
        id: 'labor-sd-materials',
        roleId: 'sd',
        roleName: 'Service Designer',
        baseHours: 182,
        complexityFactor: 1.1,
        calculatedHours: 200,
        rationale: 'Learning journey design, documentation UX, content structure.',
      },
      {
        id: 'labor-pd-materials',
        roleId: 'pd',
        roleName: 'Product Designer',
        baseHours: 91,
        complexityFactor: 1.1,
        calculatedHours: 100,
        rationale: 'Visual design for guides, job aids, video graphics.',
      },
    ],
    totalHours: 1100,
    
    qualityGrade: 'green',
    qualityIssues: [],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== 7.0 DESIGN SYSTEM & ACCESSIBILITY ====================
  {
    id: generateId(),
    wbsNumber: '7.1',
    title: 'USWDS Design System & Section 508 Compliance',
    
    sowReference: 'SOO Section 4.3; "CAMP uses a modified version of USWDS" (p.13); "100% Section 508 compliance testing" (p.6); "5th grade reading level" (p.6)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-01-01',
      end: '2025-12-31',
    },
    
    why: 'Maintain and evolve the USWDS-based design system to ensure consistent, accessible user experiences across all CAMP interfaces while meeting federal accessibility mandates and plain language requirements.',
    what: 'Govern USWDS component library for CAMP. Define and maintain accessibility standards (WCAG 2.2 AA). Conduct regular 508 compliance audits. Ensure plain language compliance at 5th grade reading level. Review all designs for accessibility before development. Verify accessibility implementation in QA.',
    notIncluded: 'USWDS core development (maintained by GSA). Third-party accessibility audits (if required). Assistive technology procurement.',
    assumptions: [
      'USWDS components meet baseline 508 requirements',
      'Team has accessibility testing tools',
      'Existing CAMP codebase has reasonable accessibility foundation',
    ],
    dependencies: [
      'USWDS version compatibility with CAMP',
      'Accessibility testing tools (axe, NVDA, JAWS)',
    ],
    
    estimateMethod: 'level-of-effort',
    complexityFactor: 1.0,
    complexityJustification: 'Ongoing governance activity - hours distributed across 26 sprints at consistent level.',
    
    laborEstimates: [
      {
        id: 'labor-dl-ds',
        roleId: 'dl',
        roleName: 'Design Lead',
        baseHours: 600,
        complexityFactor: 1.0,
        calculatedHours: 600,
        rationale: 'Design system governance (300 hrs), 508 strategy (300 hrs). ~23 hrs/sprint for ongoing oversight.',
      },
      {
        id: 'labor-uxr-ds',
        roleId: 'uxr',
        roleName: 'UX Researcher',
        baseHours: 300,
        complexityFactor: 1.0,
        calculatedHours: 300,
        rationale: 'Accessibility testing with assistive tech users (300 hrs). ~12 hrs/sprint.',
      },
      {
        id: 'labor-qa-ds',
        roleId: 'qa',
        roleName: 'QA Engineer',
        baseHours: 300,
        complexityFactor: 1.0,
        calculatedHours: 300,
        rationale: 'Automated + manual 508 testing (300 hrs). ~12 hrs/sprint integrated with feature testing.',
      },
    ],
    totalHours: 1200,
    
    qualityGrade: 'yellow', // LOE method gets yellow
    qualityIssues: ['LOE method - ensure <15-20% of total project value'],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== 8.0 SCHEDULING ENGINE (BACKEND CORE) ====================
  {
    id: generateId(),
    wbsNumber: '8.1',
    title: 'Scheduling API & Availability Engine',
    
    sowReference: 'SOO Section 3.2; Core booking logic; "API-centric approach" (p.8)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-01-01',
      end: '2025-12-31',
    },
    
    why: 'Provide the core scheduling engine that powers both public booking and admin capacity management, ensuring accurate availability calculations, conflict prevention, and reliable appointment creation at global scale.',
    what: 'Develop and maintain scheduling API endpoints. Implement availability calculation algorithms. Handle booking conflicts and race conditions. Support appointment modifications and cancellations. Implement notification triggers for confirmations. Ensure API performance for 300+ post scale.',
    notIncluded: 'Frontend implementations (separate WBS). External integrations (separate WBS). Reporting aggregations (separate WBS).',
    assumptions: [
      'MVP scheduling logic functional',
      'Database schema established by incumbent',
      'API patterns consistent with BESPIN standards',
    ],
    dependencies: [
      'Database access',
      'BESPIN API gateway configuration',
    ],
    
    estimateMethod: 'historical',
    historicalReference: {
      programName: 'VA Scheduling Engine',
      chargeNumber: 'VA-SCHED-2023-API-089',
      actualHours: 2200,
      taskDescription: 'Core scheduling API for VA healthcare appointments, similar scale and complexity',
    },
    complexityFactor: 0.85,
    complexityJustification: '15% reduction - CAMP scheduling is simpler than VA healthcare (fewer appointment types, no provider matching, no insurance verification). Enhancement of existing system vs. greenfield.',
    
    laborEstimates: [
      {
        id: 'labor-tl-sched',
        roleId: 'tl',
        roleName: 'Technical Lead',
        baseHours: 235,
        complexityFactor: 0.85,
        calculatedHours: 200,
        rationale: 'Architecture oversight, API design review, performance optimization guidance.',
      },
      {
        id: 'labor-be-sched',
        roleId: 'be',
        roleName: 'Backend Engineer',
        baseHours: 1647,
        complexityFactor: 0.85,
        calculatedHours: 1400,
        rationale: 'Core scheduling API (800 hrs), availability engine (300 hrs), conflict handling (200 hrs), notifications (100 hrs). Based on VA reference with 15% reduction.',
      },
      {
        id: 'labor-qa-sched',
        roleId: 'qa',
        roleName: 'QA Engineer',
        baseHours: 235,
        complexityFactor: 0.85,
        calculatedHours: 200,
        rationale: 'API testing, concurrency testing, edge case validation.',
      },
    ],
    totalHours: 1800,
    
    qualityGrade: 'green',
    qualityIssues: [],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== 9.0 PRODUCT MANAGEMENT & RESEARCH ====================
  {
    id: generateId(),
    wbsNumber: '9.1',
    title: 'Product Strategy & Backlog Management',
    
    sowReference: 'SOO Section 3.1; "Develop and prioritize a full gamut of user stories" (p.6); "Contribute to the development of the product vision, product roadmap(s)" (p.8)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-01-01',
      end: '2025-12-31',
    },
    
    why: 'Ensure continuous alignment between development activities and CA strategic priorities through disciplined backlog management, stakeholder engagement, and roadmap stewardship.',
    what: 'Maintain and prioritize product backlog. Write user stories with acceptance criteria. Facilitate sprint planning and reviews. Engage stakeholders for requirements discovery. Manage roadmap and communicate priorities. Define requirements for future scope (NIV, crisis management).',
    notIncluded: 'Technical implementation decisions. Government policy decisions. Budget allocation.',
    assumptions: [
      'Federal Product Owner engaged and available',
      'Stakeholder access for discovery sessions',
      'Clear prioritization framework agreed',
    ],
    dependencies: [
      'PO availability',
      'Stakeholder calendar access',
    ],
    
    estimateMethod: 'level-of-effort',
    complexityFactor: 1.0,
    complexityJustification: 'Ongoing PM activity distributed across 26 sprints.',
    
    laborEstimates: [
      {
        id: 'labor-pm-strat',
        roleId: 'pm',
        roleName: 'Product Manager',
        baseHours: 1720,
        complexityFactor: 1.0,
        calculatedHours: 1720,
        rationale: 'Backlog management (400 hrs), roadmap (200 hrs), stakeholder discovery (300 hrs), sprint ceremonies (400 hrs), requirements definition (420 hrs). ~66 hrs/sprint.',
      },
    ],
    totalHours: 1720,
    
    qualityGrade: 'yellow',
    qualityIssues: ['LOE method - ensure <15-20% of total project value'],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  {
    id: generateId(),
    wbsNumber: '9.2',
    title: 'User Research & Satisfaction Measurement',
    
    sowReference: 'SOO Section 3.4; "Achieve a 90% satisfaction rate among customers regarding the use of CAMP" (p.6); "Conduct desk research, including reviewing user research conducted prior to the beginning of this contract" (p.8); "Ensure diverse groups of users are represented" (p.8)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-01-01',
      end: '2025-12-31',
    },
    
    why: 'Continuously validate that CAMP meets user needs and achieves the 90% satisfaction target through ongoing research, usability testing, and satisfaction measurement with diverse global user populations.',
    what: 'Review incumbent research and establish baseline. Conduct ongoing usability testing each sprint. Recruit diverse user participants globally. Measure and track CSAT scores. Test plain language comprehension (5th grade level). Synthesize findings into actionable recommendations.',
    notIncluded: 'Market research for new products. Competitive analysis. Policy research.',
    assumptions: [
      'User recruitment channels established',
      'Research tools available (UserTesting, surveys)',
      'Incumbent research documentation accessible',
    ],
    dependencies: [
      'Staging environment for testing',
      'User recruitment budget',
    ],
    
    estimateMethod: 'level-of-effort',
    complexityFactor: 1.0,
    complexityJustification: 'Ongoing research activity distributed across 26 sprints.',
    
    laborEstimates: [
      {
        id: 'labor-uxr-research',
        roleId: 'uxr',
        roleName: 'UX Researcher',
        baseHours: 1320,
        complexityFactor: 1.0,
        calculatedHours: 1320,
        rationale: 'Desk research (200 hrs), user process research (300 hrs), diverse recruitment (200 hrs), usability testing (400 hrs), satisfaction metrics (200 hrs), plain language (120 hrs). ~51 hrs/sprint.',
      },
    ],
    totalHours: 1320,
    
    qualityGrade: 'yellow',
    qualityIssues: ['LOE method - ensure <15-20% of total project value'],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== 10.0 FRAUD PREVENTION ====================
  {
    id: generateId(),
    wbsNumber: '10.1',
    title: 'Fraud Detection & Prevention',
    
    sowReference: 'SOO Section 3.5; "Prevention and/or identification of Fraudulent Appointments" (p.5); "Detecting and prevent fraudulent appointment scheduling" (p.17)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-06-01',
      end: '2025-12-31',
    },
    
    why: 'Protect the integrity of the consular appointment system by detecting and preventing fraudulent booking attempts, reducing consular staff burden and ensuring legitimate applicants have fair access.',
    what: 'Design admin interface for fraud detection views. Implement rule engine for suspicious pattern detection. Create alerting system for potential fraud. Build reporting dashboard for fraud metrics. Support manual review workflows.',
    notIncluded: 'Fraud investigation (government responsibility). Legal enforcement. Policy definition for fraud rules.',
    assumptions: [
      'Fraud patterns documented from incumbent experience',
      'Government defines fraud rule thresholds',
      'Integration with existing monitoring systems',
    ],
    dependencies: [
      'Fraud rule definitions from CA',
      'Historical fraud data for pattern analysis',
    ],
    
    estimateMethod: 'engineering',
    complexityFactor: 1.0,
    complexityJustification: 'New capability without direct historical reference. Engineering estimate based on component breakdown.',
    
    laborEstimates: [
      {
        id: 'labor-pd-fraud',
        roleId: 'pd',
        roleName: 'Product Designer',
        baseHours: 80,
        complexityFactor: 1.0,
        calculatedHours: 80,
        rationale: 'Fraud detection dashboard, alert interfaces, review workflows.',
      },
      {
        id: 'labor-be-fraud',
        roleId: 'be',
        roleName: 'Backend Engineer',
        baseHours: 200,
        complexityFactor: 1.0,
        calculatedHours: 200,
        rationale: 'Rule engine (100 hrs), detection algorithms (60 hrs), alerting (40 hrs).',
      },
      {
        id: 'labor-fe-fraud',
        roleId: 'fe',
        roleName: 'Frontend Engineer',
        baseHours: 80,
        complexityFactor: 1.0,
        calculatedHours: 80,
        rationale: 'Fraud dashboard UI, alert displays, review interfaces.',
      },
      {
        id: 'labor-qa-fraud',
        roleId: 'qa',
        roleName: 'QA Engineer',
        baseHours: 40,
        complexityFactor: 1.0,
        calculatedHours: 40,
        rationale: 'Rule validation, detection accuracy testing.',
      },
    ],
    totalHours: 400,
    
    qualityGrade: 'red', // Engineering estimate without historical data
    qualityIssues: ['Engineering estimate requires detailed step-by-step breakdown'],
    isComplete: false,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ==================== COMPLETE ESTIMATE DATA ====================

export const campEstimateData: EstimateData = {
  wbsElements: campWBSElements,
  contractPeriod: {
    baseYear: true,
    optionYears: 2,
  },
  wbsPrefix: '1.0',
  lastUpdated: new Date().toISOString(),
};

// ==================== SUMMARY CALCULATIONS ====================

export const getCampBOESummary = () => {
  const totalHours = campWBSElements.reduce((sum, el) => sum + el.totalHours, 0);
  
  const hoursByRole: Record<string, number> = {};
  campWBSElements.forEach(el => {
    el.laborEstimates.forEach(labor => {
      if (!hoursByRole[labor.roleName]) {
        hoursByRole[labor.roleName] = 0;
      }
      hoursByRole[labor.roleName] += labor.calculatedHours;
    });
  });
  
  const qualityDistribution = {
    blue: campWBSElements.filter(el => el.qualityGrade === 'blue').length,
    green: campWBSElements.filter(el => el.qualityGrade === 'green').length,
    yellow: campWBSElements.filter(el => el.qualityGrade === 'yellow').length,
    red: campWBSElements.filter(el => el.qualityGrade === 'red').length,
  };
  
  return {
    totalWBSElements: campWBSElements.length,
    totalHours,
    hoursByRole,
    qualityDistribution,
    estimateMethods: {
      historical: campWBSElements.filter(el => el.estimateMethod === 'historical').length,
      parametric: campWBSElements.filter(el => el.estimateMethod === 'parametric').length,
      levelOfEffort: campWBSElements.filter(el => el.estimateMethod === 'level-of-effort').length,
      engineering: campWBSElements.filter(el => el.estimateMethod === 'engineering').length,
    },
  };
};

// ==================== ADDITIONAL WBS ELEMENTS ====================
// Adding elements to reach full 27,840 hours (14.5 FTE × 1,920)

export const campWBSElementsAdditional: WBSElement[] = [
  // ==================== 3.2 REPORTS DASHBOARD ====================
  {
    id: generateId(),
    wbsNumber: '3.2',
    title: 'Reports Dashboard & Analytics',
    
    sowReference: 'SOO Section 3.2.3; "View a reports dashboard...appointment metrics worldwide" (p.7); "Analyze appointment allocations and demand" (p.6)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-04-01',
      end: '2025-12-31',
    },
    
    why: 'Provide CA leadership and post managers with actionable insights into appointment utilization, demand patterns, and service metrics to optimize resource allocation and identify improvement opportunities.',
    what: 'Design and develop analytics dashboard with: global appointment metrics visualization, post-level drill-downs, demand forecasting displays, utilization reports, export functionality for reporting. Support multiple user role views (headquarters vs. post level).',
    notIncluded: 'Data warehouse infrastructure (BESPIN provided). BI tool licensing. Financial reporting.',
    assumptions: [
      'Analytics requirements defined by CA',
      'Data aggregation patterns established',
      'Reasonable data volumes for real-time dashboards',
    ],
    dependencies: [
      'Scheduling API data availability',
      'BESPIN data services',
    ],
    
    estimateMethod: 'parametric',
    historicalReference: {
      programName: 'FFTC Dashboard Productivity',
      chargeNumber: 'FFTC-PROD-2024-DASH',
      actualHours: 80,
      taskDescription: 'Average 80 hours per dashboard view/component for federal data visualization',
    },
    complexityFactor: 1.15,
    complexityJustification: '15% increase for global data aggregation complexity and multi-level drill-down requirements.',
    
    laborEstimates: [
      {
        id: 'labor-pd-reports',
        roleId: 'pd',
        roleName: 'Product Designer',
        baseHours: 174,
        complexityFactor: 1.15,
        calculatedHours: 200,
        rationale: '5 dashboard views × 35 hrs/view design = 175 hrs base. Includes: global overview, post detail, demand analysis, utilization, export.',
      },
      {
        id: 'labor-fe-reports',
        roleId: 'fe',
        roleName: 'Frontend Engineer',
        baseHours: 348,
        complexityFactor: 1.15,
        calculatedHours: 400,
        rationale: 'Chart components, data tables, filters, drill-downs, export functionality.',
      },
      {
        id: 'labor-be-reports',
        roleId: 'be',
        roleName: 'Backend Engineer',
        baseHours: 261,
        complexityFactor: 1.15,
        calculatedHours: 300,
        rationale: 'Data aggregation APIs, report generation, caching for performance.',
      },
      {
        id: 'labor-qa-reports',
        roleId: 'qa',
        roleName: 'QA Engineer',
        baseHours: 87,
        complexityFactor: 1.15,
        calculatedHours: 100,
        rationale: 'Data accuracy validation, visualization testing, export verification.',
      },
    ],
    totalHours: 1000,
    
    qualityGrade: 'green',
    qualityIssues: [],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== 4.3 EMAIL NOTIFICATIONS ====================
  {
    id: generateId(),
    wbsNumber: '4.3',
    title: 'Email Notification System',
    
    sowReference: 'SOO Section 3.3.3; "Emailing appointment confirmations" (p.15)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-03-01',
      end: '2025-08-31',
    },
    
    why: 'Ensure applicants receive timely, clear appointment confirmations, reminders, and status updates via email, reducing no-shows and support inquiries while maintaining professional government communications.',
    what: 'Implement SES email integration. Design email templates for: booking confirmation, reminder (24hr, 1hr), cancellation, rescheduling, payment receipt. Support multi-language templates. Implement delivery tracking and bounce handling.',
    notIncluded: 'SMS notifications (future scope). Marketing communications. Bulk email campaigns.',
    assumptions: [
      'SES configured for State Department domain',
      'Email templates approved by CA communications',
      'Multi-language content provided',
    ],
    dependencies: [
      'SES domain verification',
      'Email content approval',
    ],
    
    estimateMethod: 'historical',
    historicalReference: {
      programName: 'USCIS Email Notifications',
      chargeNumber: 'USCIS-2023-EMAIL-045',
      actualHours: 280,
      taskDescription: 'Transactional email system for USCIS case notifications, similar scale',
    },
    complexityFactor: 1.1,
    complexityJustification: '10% increase for multi-language template requirements.',
    
    laborEstimates: [
      {
        id: 'labor-be-email',
        roleId: 'be',
        roleName: 'Backend Engineer',
        baseHours: 227,
        complexityFactor: 1.1,
        calculatedHours: 250,
        rationale: 'SES integration, template engine, delivery tracking, bounce handling.',
      },
      {
        id: 'labor-pd-email',
        roleId: 'pd',
        roleName: 'Product Designer',
        baseHours: 91,
        complexityFactor: 1.1,
        calculatedHours: 100,
        rationale: 'Email template design (5 templates), responsive layout.',
      },
      {
        id: 'labor-qa-email',
        roleId: 'qa',
        roleName: 'QA Engineer',
        baseHours: 45,
        complexityFactor: 1.1,
        calculatedHours: 50,
        rationale: 'Email delivery testing, template rendering, multi-language verification.',
      },
    ],
    totalHours: 400,
    
    qualityGrade: 'green',
    qualityIssues: [],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== 5.2 AUTHENTICATION ====================
  {
    id: generateId(),
    wbsNumber: '5.2',
    title: 'Authentication & User Management',
    
    sowReference: 'SOO Section 4.2.1; "OKTA...Cognito" (p.12)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-01-01',
      end: '2025-06-30',
    },
    
    why: 'Provide secure, compliant authentication for admin users via OKTA SSO and public users via Cognito, ensuring appropriate access controls and audit logging for government security requirements.',
    what: 'Maintain and enhance OKTA SSO integration for admin users. Configure Cognito for public user registration/login. Implement role-based access control (RBAC) for admin functions. Support MFA requirements. Implement session management and audit logging.',
    notIncluded: 'PIV/CAC integration (handled by OKTA). Identity proofing (government process). Password policy changes (OKTA managed).',
    assumptions: [
      'OKTA tenant configured by State Department',
      'Cognito user pool provisioned',
      'Role definitions approved by CA',
    ],
    dependencies: [
      'OKTA configuration access',
      'Cognito credentials',
    ],
    
    estimateMethod: 'historical',
    historicalReference: {
      programName: 'DOS Auth Integration',
      chargeNumber: 'DOS-AUTH-2023-OKTA-067',
      actualHours: 350,
      taskDescription: 'OKTA + Cognito dual auth implementation for DOS portal, similar pattern',
    },
    complexityFactor: 0.9,
    complexityJustification: '10% reduction - enhancing existing auth rather than greenfield implementation.',
    
    laborEstimates: [
      {
        id: 'labor-be-auth',
        roleId: 'be',
        roleName: 'Backend Engineer',
        baseHours: 222,
        complexityFactor: 0.9,
        calculatedHours: 200,
        rationale: 'Auth integration, RBAC implementation, session management, audit logging.',
      },
      {
        id: 'labor-fe-auth',
        roleId: 'fe',
        roleName: 'Frontend Engineer',
        baseHours: 111,
        complexityFactor: 0.9,
        calculatedHours: 100,
        rationale: 'Login flows, session handling, permission-based UI.',
      },
      {
        id: 'labor-devops-auth',
        roleId: 'devops',
        roleName: 'DevOps Engineer',
        baseHours: 56,
        complexityFactor: 0.9,
        calculatedHours: 50,
        rationale: 'OKTA/Cognito configuration, secrets management.',
      },
      {
        id: 'labor-qa-auth',
        roleId: 'qa',
        roleName: 'QA Engineer',
        baseHours: 56,
        complexityFactor: 0.9,
        calculatedHours: 50,
        rationale: 'Auth flow testing, permission matrix validation.',
      },
    ],
    totalHours: 400,
    
    qualityGrade: 'green',
    qualityIssues: [],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== 6.3 TIER 2/3 SUPPORT ====================
  {
    id: generateId(),
    wbsNumber: '6.3',
    title: 'Tier 2/3 Application Support',
    
    sowReference: 'SOO Section 5.3; "Tier 2 and 3 will be performed by the contractor" (p.11); "Monitor system, network, application, database logs" (p.11)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-01-01',
      end: '2025-12-31',
    },
    
    why: 'Provide responsive technical support for escalated issues beyond Tier 1 help desk, ensuring rapid resolution of application problems and maintaining high system availability for global consular operations.',
    what: 'Respond to Tier 2 escalations (application issues). Investigate and resolve Tier 3 issues (deep technical). Monitor application and database logs. Participate in incident response. Document resolutions and known issues. Contribute to knowledge base.',
    notIncluded: 'Tier 1 help desk (government provided). Infrastructure support (BESPIN). Policy/process support (CA).',
    assumptions: [
      'Ticketing system provided by government',
      'Escalation procedures defined',
      'Reasonable ticket volume (estimate 10-20/week)',
    ],
    dependencies: [
      'Ticketing system access',
      'Log monitoring tools',
    ],
    
    estimateMethod: 'level-of-effort',
    complexityFactor: 1.0,
    complexityJustification: 'Ongoing support activity distributed across 26 sprints.',
    
    laborEstimates: [
      {
        id: 'labor-tl-support',
        roleId: 'tl',
        roleName: 'Technical Lead',
        baseHours: 400,
        complexityFactor: 1.0,
        calculatedHours: 400,
        rationale: 'Tier 3 escalation handling, incident response coordination. ~15 hrs/sprint.',
      },
      {
        id: 'labor-be-support',
        roleId: 'be',
        roleName: 'Backend Engineer',
        baseHours: 600,
        complexityFactor: 1.0,
        calculatedHours: 600,
        rationale: 'Tier 2/3 issue investigation and resolution. ~23 hrs/sprint distributed across BE team.',
      },
      {
        id: 'labor-devops-support',
        roleId: 'devops',
        roleName: 'DevOps Engineer',
        baseHours: 400,
        complexityFactor: 1.0,
        calculatedHours: 400,
        rationale: 'Log monitoring, infrastructure-related issue support. ~15 hrs/sprint.',
      },
    ],
    totalHours: 1400,
    
    qualityGrade: 'yellow',
    qualityIssues: ['LOE method - ensure <15-20% of total project value'],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== 7.2 LEGACY TRANSITION ====================
  {
    id: generateId(),
    wbsNumber: '7.2',
    title: 'Legacy System Data Migration & Transition',
    
    sowReference: 'SOO Section 3.6; "Three legacy scheduling solutions currently in place" (p.5); "Minimize transition impact to the user community" (p.11)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-03-01',
      end: '2025-12-31',
    },
    
    why: 'Successfully migrate posts from three legacy scheduling systems to CAMP while preserving historical appointment data, minimizing service disruption, and ensuring data integrity throughout the transition.',
    what: 'Analyze legacy system data schemas (3 systems). Design data migration ETL processes. Execute test migrations in staging. Coordinate cut-over scheduling with posts. Perform data validation post-migration. Support rollback procedures if needed.',
    notIncluded: 'Legacy system maintenance (incumbent responsibility until cut-over). Data archival beyond 3 years (government policy). Legacy system decommissioning (government decision).',
    assumptions: [
      'Legacy system documentation available',
      'Read access to legacy databases granted',
      'Phased migration approach approved',
    ],
    dependencies: [
      'Legacy database access',
      'Data mapping specifications',
      'Post migration schedule coordination',
    ],
    
    estimateMethod: 'historical',
    historicalReference: {
      programName: 'USCIS Legacy Migration',
      chargeNumber: 'USCIS-2022-MIGRATE-089',
      actualHours: 1200,
      taskDescription: 'Data migration from legacy case management to new system, similar complexity',
    },
    complexityFactor: 1.25,
    complexityJustification: '25% increase for three source systems (vs. single in reference) with different schemas and data quality levels.',
    
    laborEstimates: [
      {
        id: 'labor-tl-migrate',
        roleId: 'tl',
        roleName: 'Technical Lead',
        baseHours: 160,
        complexityFactor: 1.25,
        calculatedHours: 200,
        rationale: 'Migration architecture, data mapping oversight, validation strategy.',
      },
      {
        id: 'labor-be-migrate',
        roleId: 'be',
        roleName: 'Backend Engineer',
        baseHours: 560,
        complexityFactor: 1.25,
        calculatedHours: 700,
        rationale: 'ETL development for 3 systems, data transformation, validation scripts.',
      },
      {
        id: 'labor-sd-migrate',
        roleId: 'sd',
        roleName: 'Service Designer',
        baseHours: 240,
        complexityFactor: 1.25,
        calculatedHours: 300,
        rationale: 'Service blueprints for 3 legacy systems, transition journey mapping.',
      },
      {
        id: 'labor-sme-migrate',
        roleId: 'sme',
        roleName: 'DoS Subject Matter Expert',
        baseHours: 240,
        complexityFactor: 1.25,
        calculatedHours: 300,
        rationale: 'Legacy system knowledge, business rule validation, post-specific variations.',
      },
      {
        id: 'labor-qa-migrate',
        roleId: 'qa',
        roleName: 'QA Engineer',
        baseHours: 160,
        complexityFactor: 1.25,
        calculatedHours: 200,
        rationale: 'Data validation testing, migration verification, rollback testing.',
      },
    ],
    totalHours: 1700,
    
    qualityGrade: 'green',
    qualityIssues: [],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== 1.3 STAKEHOLDER MANAGEMENT ====================
  {
    id: generateId(),
    wbsNumber: '1.3',
    title: 'Stakeholder Coordination & Communication',
    
    sowReference: 'SOO Section 3.1.2; "Work in conjunction with federal Product Owner and CA team" (p.7); "Work closely with the Product Owner(s)" (p.7)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-01-01',
      end: '2025-12-31',
    },
    
    why: 'Maintain strong alignment with CA leadership, federal Product Owner, and key stakeholders across 300+ posts to ensure CAMP development priorities reflect operational needs and strategic direction.',
    what: 'Conduct weekly PO sync meetings. Facilitate stakeholder demos each sprint. Prepare and deliver monthly status reports. Coordinate with CA communications for announcements. Support executive briefings as needed. Manage stakeholder feedback channels.',
    notIncluded: 'Government decision-making. Policy communications (CA responsibility). Congressional briefings.',
    assumptions: [
      'PO available for weekly meetings',
      'Stakeholder contact list provided',
      'Video conferencing tools available',
    ],
    dependencies: [
      'PO calendar availability',
      'Stakeholder access',
    ],
    
    estimateMethod: 'level-of-effort',
    complexityFactor: 1.0,
    complexityJustification: 'Ongoing coordination distributed across 26 sprints.',
    
    laborEstimates: [
      {
        id: 'labor-dm-stakeholder',
        roleId: 'dm',
        roleName: 'Delivery Manager',
        baseHours: 800,
        complexityFactor: 1.0,
        calculatedHours: 800,
        rationale: 'Weekly PO meetings (260 hrs), monthly reports (200 hrs), stakeholder coordination (340 hrs). ~31 hrs/sprint.',
      },
      {
        id: 'labor-pm-stakeholder',
        roleId: 'pm',
        roleName: 'Product Manager',
        baseHours: 200,
        complexityFactor: 1.0,
        calculatedHours: 200,
        rationale: 'PO sync support, demo preparation, requirements communication. ~8 hrs/sprint.',
      },
    ],
    totalHours: 1000,
    
    qualityGrade: 'yellow',
    qualityIssues: ['LOE method - ensure <15-20% of total project value'],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== 9.3 DESIGN LEADERSHIP ====================
  {
    id: generateId(),
    wbsNumber: '9.3',
    title: 'Design Team Leadership & Quality',
    
    sowReference: 'SOO Section 3.4.2; "Conduct design QA" (p.8); "Share research findings with engineers, PMs, product owners" (p.8); "Synthesize research and create design artifacts" (p.8)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-01-01',
      end: '2025-12-31',
    },
    
    why: 'Ensure design excellence across all CAMP interfaces through consistent leadership, quality review, cross-functional collaboration, and synthesis of research insights into actionable design direction.',
    what: 'Lead design team across Product Designer, UX Researcher, Service Designer. Conduct design reviews before development handoff. Synthesize research findings into design recommendations. Present design rationale to stakeholders. Mentor team members. Ensure design consistency across features.',
    notIncluded: 'Individual feature design (other WBS). Research execution (UX Researcher WBS). Service blueprint creation (Service Designer WBS).',
    assumptions: [
      'Design team fully staffed',
      'Collaboration tools available (Figma, etc.)',
      'Regular design review cadence established',
    ],
    dependencies: [
      'Design tool licenses',
      'Team availability',
    ],
    
    estimateMethod: 'level-of-effort',
    complexityFactor: 1.0,
    complexityJustification: 'Ongoing leadership activity distributed across 26 sprints.',
    
    laborEstimates: [
      {
        id: 'labor-dl-leadership',
        roleId: 'dl',
        roleName: 'Design Lead',
        baseHours: 1320,
        complexityFactor: 1.0,
        calculatedHours: 1320,
        rationale: 'Team leadership (200 hrs), design review/QA (300 hrs), research synthesis (200 hrs), stakeholder presentations (200 hrs), MVP assessment (160 hrs), multi-language UX (160 hrs), crisis UX (100 hrs). ~51 hrs/sprint.',
      },
    ],
    totalHours: 1320,
    
    qualityGrade: 'yellow',
    qualityIssues: ['LOE method - ensure <15-20% of total project value'],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== 9.4 TECHNICAL LEADERSHIP ====================
  {
    id: generateId(),
    wbsNumber: '9.4',
    title: 'Technical Architecture & Code Quality',
    
    sowReference: 'SOO Section 4.1; "API-centric approach" (p.8); "Pull request review process" (p.8); "Security reviews embedded as an engineering practice" (p.9)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-01-01',
      end: '2025-12-31',
    },
    
    why: 'Maintain technical excellence and code quality through architectural oversight, code review, security guidance, and engineering best practices to ensure a maintainable, secure, and scalable CAMP platform.',
    what: 'Oversee system architecture decisions. Conduct code reviews for critical components. Guide security-by-design practices. Manage technical debt prioritization. Mentor engineering team. Document architectural decisions and patterns.',
    notIncluded: 'Feature development (other WBS). DevOps operations (WBS 5.1). Support operations (WBS 6.3).',
    assumptions: [
      'Code review tooling in place',
      'Architecture documentation repository exists',
      'Team follows established patterns',
    ],
    dependencies: [
      'Git repository access',
      'Documentation platform',
    ],
    
    estimateMethod: 'level-of-effort',
    complexityFactor: 1.0,
    complexityJustification: 'Ongoing technical leadership distributed across 26 sprints.',
    
    laborEstimates: [
      {
        id: 'labor-tl-arch',
        roleId: 'tl',
        roleName: 'Technical Lead',
        baseHours: 1020,
        complexityFactor: 1.0,
        calculatedHours: 1020,
        rationale: 'Architecture oversight (300 hrs), code review (300 hrs), security reviews (200 hrs), tech debt management (120 hrs), mentoring (100 hrs). ~39 hrs/sprint.',
      },
    ],
    totalHours: 1020,
    
    qualityGrade: 'yellow',
    qualityIssues: ['LOE method - ensure <15-20% of total project value'],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== 2.2 POST CONFIGURATION ====================
  {
    id: generateId(),
    wbsNumber: '2.2',
    title: 'Post Configuration & Customization',
    
    sowReference: 'SOO Section 3.2.4; "Post to configure various aspects of the system" (p.7); "Post specific needs will be identified during discovery" (p.7)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-04-01',
      end: '2025-12-31',
    },
    
    why: 'Enable posts to customize CAMP for their specific operational needs including appointment types, service windows, officer assignments, and local business rules while maintaining platform consistency.',
    what: 'Design post configuration interface. Implement appointment type customization. Support service window configuration. Enable officer/resource assignment. Implement local business rules engine. Provide configuration validation and preview.',
    notIncluded: 'Per-post custom development. Integration with post-specific systems. Policy definition (CA responsibility).',
    assumptions: [
      'Configuration requirements gathered from pilot posts',
      'Standard configuration patterns identified',
      'Reasonable configuration complexity',
    ],
    dependencies: [
      'Post requirements from rollout planning',
      'Admin portal foundation (WBS 3.1)',
    ],
    
    estimateMethod: 'parametric',
    historicalReference: {
      programName: 'FFTC Configuration Module Data',
      chargeNumber: 'FFTC-PROD-2024-CONFIG',
      actualHours: 60,
      taskDescription: 'Average 60 hours per configuration module for federal multi-tenant SaaS',
    },
    complexityFactor: 1.2,
    complexityJustification: '20% increase for post-specific validation rules and preview functionality requirements.',
    
    laborEstimates: [
      {
        id: 'labor-pm-config',
        roleId: 'pm',
        roleName: 'Product Manager',
        baseHours: 83,
        complexityFactor: 1.2,
        calculatedHours: 100,
        rationale: 'Configuration requirements definition from 50+ posts.',
      },
      {
        id: 'labor-pd-config',
        roleId: 'pd',
        roleName: 'Product Designer',
        baseHours: 167,
        complexityFactor: 1.2,
        calculatedHours: 200,
        rationale: 'Configuration UI design (5 config modules × 40 hrs base).',
      },
      {
        id: 'labor-fe-config',
        roleId: 'fe',
        roleName: 'Frontend Engineer',
        baseHours: 333,
        complexityFactor: 1.2,
        calculatedHours: 400,
        rationale: 'Configuration forms, validation UI, preview functionality.',
      },
      {
        id: 'labor-be-config',
        roleId: 'be',
        roleName: 'Backend Engineer',
        baseHours: 250,
        complexityFactor: 1.2,
        calculatedHours: 300,
        rationale: 'Configuration API, rules engine, validation logic.',
      },
      {
        id: 'labor-sme-config',
        roleId: 'sme',
        roleName: 'DoS Subject Matter Expert',
        baseHours: 167,
        complexityFactor: 1.2,
        calculatedHours: 200,
        rationale: 'Post-specific business rules, configuration validation.',
      },
      {
        id: 'labor-qa-config',
        roleId: 'qa',
        roleName: 'QA Engineer',
        baseHours: 83,
        complexityFactor: 1.2,
        calculatedHours: 100,
        rationale: 'Configuration testing, validation verification.',
      },
    ],
    totalHours: 1300,
    
    qualityGrade: 'green',
    qualityIssues: [],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== 8.2 TESTING & QUALITY ASSURANCE ====================
  {
    id: generateId(),
    wbsNumber: '8.2',
    title: 'Quality Assurance & Test Automation',
    
    sowReference: 'SOO Section 4.4; "Testing integrated into the project" (p.8); "Unit testing, automated integration, component testing" (p.8); "Minimize escaped defects" (p.8)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-01-01',
      end: '2025-12-31',
    },
    
    why: 'Ensure CAMP reliability and quality through comprehensive test coverage, automated regression testing, and continuous quality assurance integrated into the agile development process.',
    what: 'Develop and maintain test strategy. Create and execute functional test cases. Build automated regression test suite. Conduct performance and load testing. Execute cross-browser and device testing. Verify bug fixes and track defect metrics.',
    notIncluded: 'Accessibility testing (WBS 7.1). Security penetration testing (if required). User acceptance testing (government responsibility).',
    assumptions: [
      'Test automation framework established',
      'Test environment stable',
      'Reasonable defect volume',
    ],
    dependencies: [
      'Test environment access',
      'Test data availability',
    ],
    
    estimateMethod: 'level-of-effort',
    complexityFactor: 1.0,
    complexityJustification: 'Ongoing QA activity distributed across 26 sprints.',
    
    laborEstimates: [
      {
        id: 'labor-qa-automation',
        roleId: 'qa',
        roleName: 'QA Engineer',
        baseHours: 1100,
        complexityFactor: 1.0,
        calculatedHours: 1100,
        rationale: 'Test planning (150 hrs), functional testing (300 hrs), regression (200 hrs), performance (100 hrs), cross-browser (100 hrs), bug verification (150 hrs), documentation (100 hrs). ~42 hrs/sprint.',
      },
    ],
    totalHours: 1100,
    
    qualityGrade: 'yellow',
    qualityIssues: ['LOE method - ensure <15-20% of total project value'],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== 9.5 SERVICE DESIGN & CHANGE MANAGEMENT ====================
  {
    id: generateId(),
    wbsNumber: '9.5',
    title: 'Service Design & Change Management',
    
    sowReference: 'SOO Section 3.4.3; "Consular officers change duty locations and leave them with different experiences and challenges to manage" (p.5); "Minimize transition impact to the user community" (p.11)',
    clin: '0001',
    periodOfPerformance: {
      start: '2025-01-01',
      end: '2025-12-31',
    },
    
    why: 'Design holistic service experiences that account for the full user journey across digital and physical touchpoints, ensuring consistent experiences for officers rotating between posts and supporting organizational change adoption.',
    what: 'Map end-to-end service journeys for public and admin users. Design consistent cross-post experiences. Develop change management strategy for rollout. Create support process designs (Tier 2/3 flows). Design documentation and help experiences. Address crisis response workflows.',
    notIncluded: 'Post-specific process changes (CA decision). Organizational restructuring. Change management execution (government responsibility).',
    assumptions: [
      'Service design research completed during discovery',
      'Stakeholder buy-in for journey improvements',
      'Access to cross-post user research',
    ],
    dependencies: [
      'UX research findings',
      'Post operational data',
    ],
    
    estimateMethod: 'level-of-effort',
    complexityFactor: 1.0,
    complexityJustification: 'Ongoing service design activity distributed across 26 sprints.',
    
    laborEstimates: [
      {
        id: 'labor-sd-service',
        roleId: 'sd',
        roleName: 'Service Designer',
        baseHours: 1120,
        complexityFactor: 1.0,
        calculatedHours: 1120,
        rationale: 'Admin workflow mapping (200 hrs), support process design (200 hrs), change management (200 hrs), documentation UX (200 hrs), crisis workflows (120 hrs), ongoing service improvements (200 hrs). ~43 hrs/sprint.',
      },
    ],
    totalHours: 1120,
    
    qualityGrade: 'yellow',
    qualityIssues: ['LOE method - ensure <15-20% of total project value'],
    isComplete: true,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Combine all WBS elements
export const campAllWBSElements = [...campWBSElements, ...campWBSElementsAdditional];

// Update the estimate data export
export const campEstimateDataComplete: EstimateData = {
  wbsElements: campAllWBSElements,
  contractPeriod: {
    baseYear: true,
    optionYears: 2,
  },
  wbsPrefix: '1.0',
  lastUpdated: new Date().toISOString(),
};

// ==================== UPDATED SUMMARY ====================

export const getCampBOESummaryComplete = () => {
  const totalHours = campAllWBSElements.reduce((sum, el) => sum + el.totalHours, 0);
  
  const hoursByRole: Record<string, number> = {};
  campAllWBSElements.forEach(el => {
    el.laborEstimates.forEach(labor => {
      if (!hoursByRole[labor.roleName]) {
        hoursByRole[labor.roleName] = 0;
      }
      hoursByRole[labor.roleName] += labor.calculatedHours;
    });
  });
  
  const qualityDistribution = {
    blue: campAllWBSElements.filter(el => el.qualityGrade === 'blue').length,
    green: campAllWBSElements.filter(el => el.qualityGrade === 'green').length,
    yellow: campAllWBSElements.filter(el => el.qualityGrade === 'yellow').length,
    red: campAllWBSElements.filter(el => el.qualityGrade === 'red').length,
  };
  
  // Calculate team totals
  const teamTarget = {
    'Delivery Manager': 1920,
    'Product Manager': 1920,
    'Design Lead': 1920,
    'Product Designer': 1920,
    'UX Researcher': 1920,
    'DoS Subject Matter Expert': 960,
    'Service Designer': 1920,
    'IT Training Specialist': 1920,
    'Technical Lead': 1920,
    'Frontend Engineer': 3840,
    'Backend Engineer': 3840,
    'DevOps Engineer': 1920,
    'QA Engineer': 1920,
  };
  
  const utilizationByRole: Record<string, { allocated: number; target: number; utilization: number }> = {};
  Object.entries(teamTarget).forEach(([role, target]) => {
    const allocated = hoursByRole[role] || 0;
    utilizationByRole[role] = {
      allocated,
      target,
      utilization: Math.round((allocated / target) * 100),
    };
  });
  
  return {
    totalWBSElements: campAllWBSElements.length,
    totalHours,
    targetHours: 27840,
    variance: totalHours - 27840,
    hoursByRole,
    utilizationByRole,
    qualityDistribution,
    estimateMethods: {
      historical: campAllWBSElements.filter(el => el.estimateMethod === 'historical').length,
      parametric: campAllWBSElements.filter(el => el.estimateMethod === 'parametric').length,
      levelOfEffort: campAllWBSElements.filter(el => el.estimateMethod === 'level-of-effort').length,
      engineering: campAllWBSElements.filter(el => el.estimateMethod === 'engineering').length,
    },
  };
};

// Log summary for verification
console.log('CAMP BOE Complete Summary:', JSON.stringify(getCampBOESummaryComplete(), null, 2));