import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const STANDARD_APPROACHES = [
  {
    id: crypto.randomUUID(),
    title: "FFTC Frontend Development Approach",
    category: "engineering",
    body: "Frontend development at Friends From The City starts with the design system and ends with the user. The gap between a design file and a working interface is where most quality problems originate. Friends closes that gap by involving engineers in design review before components are built, not after.\n\nFriends builds federal frontends in React with TypeScript, using component libraries aligned to the US Web Design System or agency-specific design systems where they exist. Components are built to be reusable, accessible, and testable from the start. A component that ships without keyboard navigation support, ARIA attributes, and color contrast verification has not been finished. These are not post-launch concerns.\n\nResponsive design is implemented across the device range federal users actually use. Government employees access systems on managed desktops with older browsers. Veterans and beneficiaries access services on mobile devices with variable network conditions. Friends builds to the real constraint, not the ideal one.\n\nState management decisions are made based on application complexity. React Context handles shared state for simpler applications. More complex applications with multiple data streams use structured state management patterns that make data flow traceable and testable. The choice is documented so future engineers can understand why it was made.\n\nPerformance is measured, not assumed. Friends monitors Core Web Vitals, bundle size, and time-to-interactive on federal applications. Lazy loading, code splitting, and asset optimization are applied based on actual performance data rather than as defaults applied uniformly.",
    customizationNotes: "If the agency has a specific design system (VA Design System, USWDS, CMS Design System), name it explicitly. If there are known browser support requirements (IE11, specific government-managed browser versions), add a sentence describing how the implementation accounts for them.",
    tags: ["frontend", "React", "TypeScript", "USWDS", "accessibility", "engineering"]
  },
  {
    id: crypto.randomUUID(),
    title: "FFTC Backend Development Approach",
    category: "engineering",
    body: "Backend systems for federal applications carry obligations that commercial systems do not. Data belongs to the agency. Integrations connect to systems of record that cannot be taken offline for testing. Errors surface as failed benefit claims, missed appointments, and unprocessed payments. Friends designs backend architecture with those stakes in mind.\n\nFriends builds REST APIs using Node.js, following consistent patterns for request validation, error handling, and response structure across endpoints. API contracts are documented before implementation begins so frontend development and backend development can proceed in parallel without waiting on each other. When an API contract changes, both sides know immediately.\n\nDatabase design decisions are made around query patterns and access controls, not just data structure. Federal applications frequently require row-level permissions, audit logging, and data retention policies. These requirements are addressed in the schema design phase, not retrofitted after the application is built.\n\nIntegration with external federal systems requires patience and discipline. Agency APIs have rate limits, authentication protocols, and data formats that change without warning. Friends wraps external integrations with abstraction layers that isolate the rest of the application from those changes. When a third-party API behaves unexpectedly, the failure is contained rather than cascading.\n\nError handling is explicit. Every API endpoint returns structured error responses that the frontend can act on. Logging captures enough context to diagnose a production issue without capturing PII or sensitive data that should not appear in logs.",
    customizationNotes: "Note this is aspirational for contracts where Friends has not yet delivered backend work. Update with specific technologies used on relevant contracts when available. If contract requires specific language (Python, Java, Go) or framework, revise accordingly.",
    tags: ["backend", "Node.js", "REST API", "engineering", "federal"]
  },
  {
    id: crypto.randomUUID(),
    title: "FFTC DevOps and Infrastructure Approach",
    category: "engineering",
    body: "Federal infrastructure decisions are constrained by agency authorization boundaries, approved technology lists, and existing contract vehicles. Friends works within those constraints rather than around them. The first question on any infrastructure discussion is what the agency has already authorized, not what would be ideal in an unconstrained environment.\n\nInfrastructure as code is the default. Environment configuration, resource provisioning, and network topology are defined in version-controlled files rather than managed through manual console operations. This makes environments reproducible, auditable, and recoverable. It also means a new team member can understand the entire infrastructure by reading files rather than being briefed on undocumented decisions.\n\nEnvironment parity between development, staging, and production prevents the class of bugs that only appear after deployment. Friends maintains environment configuration as a first-class concern, not as an afterthought addressed when something breaks in production.\n\nMonitoring and alerting are configured before launch, not after the first production incident. Application health metrics, error rates, and performance baselines are established during development so the team knows what normal looks like before users start reporting problems.\n\nDisaster recovery planning addresses the specific recovery time and recovery point objectives the agency requires. Backup procedures, failover configurations, and recovery runbooks are documented and tested before the system goes live.",
    customizationNotes: "Note this is aspirational. Update with specific cloud provider, infrastructure tools, and authorization boundary details when contract specifics are known. If agency has specific approved tools (AWS GovCloud, Azure Government, specific CDN or WAF requirements), name them.",
    tags: ["DevOps", "infrastructure", "cloud", "engineering", "federal"]
  },
  {
    id: crypto.randomUUID(),
    title: "FFTC Testing Approach",
    category: "engineering",
    body: "Testing at Friends is a development activity, not a phase that comes after development. Test coverage is written alongside code, not after it. This changes the economics of quality: defects caught during development cost almost nothing to fix. Defects caught in user acceptance testing cost significantly more. Defects that reach Veterans, beneficiaries, or federal employees cost the most.\n\nUnit tests verify that individual functions and components behave correctly in isolation. Integration tests verify that components work together as expected. End-to-end tests verify complete user workflows from the interface through the backend and back. Each layer catches different classes of problems. Friends maintains all three.\n\nAccessibility testing runs throughout development, not in a final audit. Automated tools like axe catch a meaningful percentage of WCAG violations. Manual testing with keyboard navigation and screen readers catches the rest. On the CMS Quality Payment Program, this approach reduced WCAG 2.1 AA violations by 95 percent compared to the state of the site before Friends joined the engagement.\n\nToggle-aware testing matters on federal applications where features are released behind flags. Friends writes tests that verify both the current production behavior and the new feature behavior simultaneously. On the VA PACT Act 526ez, this approach prevented regressions from reaching Veterans when the new toxic exposure claims feature launched.\n\nPerformance testing establishes baselines before launch. Load testing verifies the application handles expected traffic volumes. Response time targets are set based on what federal users actually experience, not on theoretical benchmarks.",
    customizationNotes: "Reference specific testing frameworks if the contract or agency has preferences (Jest, Cypress, Playwright, Testing Library). If the agency has a formal UAT process, add a sentence describing how Friends' testing feeds into and prepares for that process.",
    tags: ["testing", "QA", "accessibility", "regression", "engineering"]
  },
  {
    id: crypto.randomUUID(),
    title: "FFTC Code Review Approach",
    category: "engineering",
    body: "Code review at Friends serves three functions: catching defects before they reach users, maintaining consistency across a codebase that multiple engineers work on, and transferring knowledge between team members. All three matter on federal contracts where the government inherits the codebase and the documentation when the contract ends.\n\nNo code merges without review. This is not a preference — it is a process requirement. Pull requests describe what changed and why, not just what changed. A reviewer who cannot understand the intent of a change from reading the description has not received enough context.\n\nReview criteria are explicit and shared. Reviewers check functionality, test coverage, accessibility, security patterns, and adherence to the team's established conventions. Subjective preferences about style are resolved by the linting configuration, not in pull request comments. This keeps review focused on substance.\n\nSecurity-relevant changes receive additional scrutiny. Authentication logic, data handling, input validation, and integration with external systems are reviewed with security considerations as a primary concern, not as an afterthought after the functional review is complete.\n\nReview is a learning environment. Comments explain the reasoning behind requested changes rather than just stating what to change. Engineers earlier in their careers receive the context they need to understand the decision, not just the instruction to change it.",
    customizationNotes: "If the agency has a specific code review or approval process before merging to production (security review board, change advisory board), add a sentence describing how Friends' review process integrates with that requirement.",
    tags: ["code review", "engineering", "quality", "security"]
  },
  {
    id: crypto.randomUUID(),
    title: "FFTC CI/CD and Deployment Pipeline Approach",
    category: "engineering",
    body: "A deployment pipeline that works reliably is infrastructure. A deployment pipeline that fails unpredictably is a source of risk that accumulates over time. Friends treats pipeline reliability as a product requirement, not a DevOps concern separate from the application.\n\nContinuous integration runs on every pull request. Automated tests, linting, type checking, and build verification run before any code reaches the main branch. A failing pipeline blocks the merge. This means the main branch is always in a deployable state.\n\nFeature flags separate deployment from release. Code can be deployed to production without activating new functionality for users. This allows the team to verify deployment stability before a feature goes live, roll back specific features without rolling back deployments, and release to a subset of users before full rollout. On the VA PACT Act 526ez, feature flags allowed the team to test the new toxic exposure claims flow in production without exposing it to Veterans before it was ready.\n\nDeployment to federal environments follows change management procedures. Friends coordinates with agency change advisory boards, schedules deployments during approved maintenance windows, and communicates changes to relevant stakeholders before and after deployments. Deployment is not a technical event that happens outside the agency's awareness.\n\nRollback procedures are defined before deployment, not after a production incident. Every deployment has a tested rollback path. The time to restore a previous state is known in advance.",
    customizationNotes: "If the agency has specific change management requirements (CAB approvals, maintenance windows, deployment notification procedures), name them explicitly. If the contract uses a specific CI/CD platform (GitHub Actions, Jenkins, AWS CodePipeline), name it.",
    tags: ["CI/CD", "deployment", "feature flags", "engineering", "pipeline"]
  },
  {
    id: crypto.randomUUID(),
    title: "FFTC UX/UI Design Process",
    category: "design",
    body: "The design process at Friends starts with what users need to accomplish, not with what the interface should look like. Visual design decisions are downstream of functional decisions. A well-designed interface that solves the wrong problem is still a failure.\n\nDiscovery work establishes the constraints before design begins. What do users currently do? Where do they get stuck? What does success look like to them, not to the agency? These questions are answered through research, not assumed from requirements documents. Requirements describe what the system should do. Research reveals what users actually need.\n\nDesign work moves from rough to resolved. Low-fidelity sketches and flows explore the problem space before any time is invested in polished screens. The team reviews rough work before it becomes detailed work. This prevents the common failure mode where detailed design work is presented to stakeholders and fundamental problems are discovered after significant investment.\n\nHandoff from design to engineering is not a moment — it is a process. Engineers participate in design reviews before components are specced. Designers participate in engineering reviews before components are built. Questions about feasibility, edge cases, and technical constraints are resolved collaboratively rather than through a handoff document that cannot answer follow-up questions.\n\nDesign decisions are documented. Not as a deliverable for its own sake, but because the people who inherit this work need to understand why the interface works the way it does. Undocumented design decisions become mysterious constraints that future teams work around rather than with.",
    customizationNotes: "If the contract involves a specific design phase structure (discovery sprint, design sprint, build sprint), describe how Friends' design process maps to those phases.",
    tags: ["design", "UX", "UI", "process", "federal"]
  },
  {
    id: crypto.randomUUID(),
    title: "FFTC Design Systems Approach",
    category: "design",
    body: "Design systems solve a coordination problem. When multiple designers and engineers work on the same product over multiple years, interfaces drift apart. Components built independently accumulate small differences that add up to a product that feels inconsistent to users. Design systems prevent that drift by establishing shared patterns that everyone uses rather than rebuilds.\n\nFriends works within established federal design systems — the US Web Design System, the VA Design System, the CMS Design System — rather than creating new ones where an authoritative one already exists. Working within a federal design system means the component meets accessibility requirements that have already been verified, is familiar to users who have encountered it elsewhere in the federal digital ecosystem, and will be maintained by the platform team after the contract ends.\n\nWhen a design system does not have a component the product needs, Friends builds it to the same standards as the existing components and contributes it back. On the VA Clinical Decision Support Collaborative, Friends built five data visualization patterns that five product teams needed and that the design system did not have. Six of those components were adopted by the US Web Design System and the VA Design System, where they now support teams across the federal government.\n\nComponent documentation is written for the engineers who will implement it, not for the designers who created it. Usage guidelines, accessibility notes, and implementation examples are part of every component specification.",
    customizationNotes: "Name the specific design system relevant to this contract (USWDS, VA Design System, CMS Design System, agency-specific system). If the contract requires creating a new design system from scratch, adjust accordingly.",
    tags: ["design systems", "USWDS", "VA", "CMS", "components", "federal"]
  },
  {
    id: crypto.randomUUID(),
    title: "FFTC Content Strategy and Plain Language",
    category: "design",
    body: "Content is the interface. A form that asks the right question clearly is more valuable than a beautifully designed form that confuses the people filling it out. Friends treats content as a design material, not as text that gets added after the design is done.\n\nPlain language in federal digital services is not a style preference — it is an equity requirement. The people who use government services represent the full range of reading levels, language backgrounds, and digital literacy across the country. Writing at a Grade 8 reading level is not dumbing down the content. It is making the service accessible to the people it is meant to serve.\n\nContent audits establish the baseline before any writing begins. What content currently exists? What do users actually read? What do they skip? What generates help desk tickets? On the CMS Quality Payment Program, help desk ticket analysis revealed that users were asking the same questions year after year. The content existed. Users could not find it. The problem was structure, not substance.\n\nContent decisions are tested with users, not evaluated internally. A label that makes sense to the team that wrote it may not make sense to the person filing a claim at 11pm on a mobile device. Friends tests content assumptions the same way it tests interaction assumptions — with real users completing real tasks.\n\nContent governance matters as much as content creation. Friends documents the voice, tone, and terminology decisions made during a project so that future content editors maintain consistency. On the VA.gov CMS, this translated into real-time error messaging that caught content violations as editors were creating content rather than discovering them in audits weeks later.",
    customizationNotes: "If the agency has an existing style guide or content standards (VA content style guide, plain language guidelines), name them and describe how Friends' approach aligns with and extends those standards.",
    tags: ["content strategy", "plain language", "UX writing", "federal", "accessibility"]
  },
  {
    id: crypto.randomUUID(),
    title: "FFTC Information Architecture Approach",
    category: "design",
    body: "Information architecture determines whether users can find what they need. It is invisible when it works and immediately apparent when it does not. The QPP site was receiving 8,834 help desk tickets in a single submission window. Research showed that the content users needed existed. The navigation did not match how users thought about the task. Changing the organization of the same content reduced key tasks from seven clicks to three.\n\nInformation architecture work at Friends starts with user mental models, not with the agency's organizational structure. Agencies organize information around their internal divisions, programs, and processes. Users organize information around their goals and questions. These two structures rarely match. Navigation that makes sense to program staff often baffles the people those programs are meant to serve.\n\nCard sorting surfaces how users categorize content before the team commits to a structure. Tree testing verifies that a proposed structure works before it is built. Both methods produce data that makes architectural decisions defensible rather than subjective. When stakeholders disagree about how to organize something, user research resolves the question.\n\nSearch is not a substitute for good information architecture. Users who cannot find something through navigation turn to search. Search that requires knowing the right vocabulary fails users who do not have that vocabulary. Friends addresses both the navigation structure and the search experience as complementary problems, not as alternatives.",
    customizationNotes: "If the contract involves a large content migration or a site with significant legacy content, add a sentence about the content audit and migration planning process. If the agency has specific navigation or taxonomy requirements, reference them.",
    tags: ["information architecture", "wayfinding", "navigation", "UX", "federal"]
  },
  {
    id: crypto.randomUUID(),
    title: "FFTC User Research Methods",
    category: "research",
    body: "Research at Friends produces findings specific enough to change a decision. A finding that does not change anything was not worth collecting. The test of useful research is not whether it was rigorous — it is whether the team did something different because of it.\n\nFriends selects research methods based on the question being asked, not on familiarity or preference. Generative research explores problems before solutions exist. Evaluative research tests solutions before they ship. Behavioral research observes what people actually do rather than what they say they do. Each method answers a different category of question. Using the wrong method produces confident findings about the wrong thing.\n\nRecruitment matters as much as the research itself. Friends recruits participants who represent the range of people the service is meant to serve — across age, digital literacy, disability status, language background, and geography. Research conducted only with the most available or cooperative users produces findings that describe those users, not the full population. On the Maryland OneStop project, recruiting across race, income, age, and geography produced findings that the agency described as revealing disparities they had not previously seen.\n\nSynthesis transforms observations into actionable findings. Raw notes from research sessions become patterns. Patterns become findings. Findings become recommendations with specific implementation guidance. The distance between what a participant said and what the team decides to build is where research value is either preserved or lost.",
    customizationNotes: "List specific research methods most relevant to this contract: moderated usability testing, contextual inquiry, co-design, diary studies, surveys, stakeholder interviews, card sorting, tree testing, heuristic evaluation, analytics review, help desk ticket analysis.",
    tags: ["user research", "research methods", "usability", "federal"]
  },
  {
    id: crypto.randomUUID(),
    title: "FFTC Usability Testing Approach",
    category: "research",
    body: "Usability testing answers a specific question: can the people this is designed for actually use it to accomplish their goals? The answer is frequently no, and finding that out before launch is the entire point.\n\nFriends conducts moderated usability sessions with participants recruited to match the actual user population, not the most convenient one. Sessions are structured to observe natural behavior rather than guide participants to successful completion. A participant who struggles is providing more useful information than a participant who succeeds. The struggle is the finding.\n\nTask selection determines what a usability test can reveal. Tasks must be realistic — things the participant would actually need to do — and specific enough to produce observable behavior. Vague tasks produce vague findings. A participant asked to explore the site will do something different from a participant asked to find out whether they qualify for a tax credit and submit an application.\n\nSynthesis of usability findings distinguishes between symptoms and causes. A participant who cannot find the login button has a navigation problem. A participant who finds the login button but then abandons the form has a different problem. Treating both as usability issues and listing them in a findings document without distinguishing their causes produces a report that describes the surface without explaining the problem.\n\nFindings are prioritized for action. Not every usability problem has equal consequence. Friends prioritizes findings by the frequency with which they occurred across participants, the severity of the impact on task completion, and the effort required to address them.",
    customizationNotes: "Specify whether testing will be moderated or unmoderated, remote or in-person, formative or summative. If the agency requires specific participants (Veterans, clinicians, benefits administrators), note the recruitment approach and any screening criteria.",
    tags: ["usability testing", "moderated", "research", "UX", "federal"]
  },
  {
    id: crypto.randomUUID(),
    title: "FFTC Trauma-Informed Research Protocols",
    category: "research",
    body: "Some federal services require users to describe experiences they would prefer not to revisit. Veterans filing disability claims describe the events that caused their injuries. Survivors of Military Sexual Trauma describe what happened to them. Refugees describe the circumstances that brought them to the United States. Research with these populations requires a different kind of preparation than standard usability testing.\n\nFriends developed trauma-informed research protocols during work on the VA benefits claims system. The protocols address how moderators respond when a participant becomes distressed, how participants can step back from a session without feeling they have failed, what support resources are made available before and after sessions, and how the research team processes difficult sessions. These protocols are now documented and applied across any Friends engagement where participants may be asked to engage with difficult material.\n\nInformed consent for trauma-informed research is more extensive than standard research consent. Participants need to understand specifically what they will be asked before they agree to participate, including which topics may surface difficult memories. This is not just an ethical requirement — it produces better research. Participants who understand what they are being asked to do are more willing to engage authentically with the task.\n\nNote-taking and debriefing practices protect both participants and researchers. Notes capture observations without recording sensitive personal disclosures that participants did not intend to become part of a research record. Debrief sessions after difficult research days give the research team an opportunity to process what they heard before moving to the next participant.",
    customizationNotes: "This approach applies when research participants may be asked about disability, trauma, financial hardship, immigration status, or other sensitive topics. If the contract does not involve sensitive populations, this approach is not needed. If it does, add the specific population and context to the opening paragraph.",
    tags: ["trauma-informed research", "VA", "Veterans", "sensitive populations", "research"]
  },
  {
    id: crypto.randomUUID(),
    title: "FFTC Service Design Approach",
    category: "research",
    body: "Service design addresses the full experience a person has with a government service — not just the digital interface, but the letters they receive before applying, the call center they contact when something goes wrong, the notification they get after submitting, and the wait between submission and outcome. Digital interfaces are one touchpoint in a longer journey. Improving only the digital touchpoint while the rest of the experience remains broken produces limited results.\n\nOn the Maryland OneStop project, the online application rated 84 percent satisfactory by users. The failures were happening in outreach letters that confused eligible applicants about whether they qualified, and in post-submission silence that left applicants unsure whether their application had been received. Fixing the form would have addressed 16 percent of the problem. Understanding the full service journey revealed the other 84 percent.\n\nService blueprints map what users experience alongside what the agency does to produce that experience. They make visible the behind-the-scenes processes, the staff actions, the supporting systems, and the failure points that users never see but feel the consequences of. Blueprints are not deliverables for their own sake — they are diagnostic tools that help agencies understand which interventions will produce the most impact.\n\nJourney maps document the emotional arc of a service experience alongside the functional one. Where do people feel informed and confident? Where do they feel confused and anxious? Where do they give up? These moments are not equally distributed across the journey. Finding the highest-stakes moments determines where design investment produces the most value.",
    customizationNotes: "If the contract involves multiple channels (online portal, phone, mail, in-person), describe how the service design work addresses the interactions between channels. If the agency has existing journey mapping work, describe how Friends' approach builds on it.",
    tags: ["service design", "journey mapping", "blueprinting", "research", "federal"]
  },
  {
    id: crypto.randomUUID(),
    title: "FFTC Product Management Approach",
    category: "product",
    body: "Product management on federal contracts operates at the intersection of agency priorities, user needs, and technical constraints. The product manager's job is to hold all three in view simultaneously and make prioritization decisions that advance the mission without creating technical debt that makes future work harder.\n\nThe product roadmap is a living document, not a commitment made at project kickoff. Roadmaps are built from a combination of agency strategy, user research findings, technical feasibility, and compliance requirements. They change when any of those inputs changes. A product manager who treats the roadmap as a contract rather than a plan will either deliver the wrong thing or spend the contract defending decisions made before the team understood the problem.\n\nBacklog prioritization uses frameworks that make trade-offs explicit. Effort estimates from engineering, impact estimates from research and stakeholder input, and risk assessments from compliance and security review combine to produce a prioritized list that the team can defend to the agency and to themselves. The priority is always answerable: this is at the top of the backlog because it delivers the most mission impact for the least risk and effort.\n\nThe product manager coordinates communication across the team, the agency, and any teaming partners. Status is communicated proactively rather than in response to requests. Risks are escalated before they become problems. Decisions are documented so that the reasoning behind them is recoverable when circumstances change.",
    customizationNotes: "If the contract has a specific product governance structure (Product Owner on the government side, advisory board, steering committee), describe how Friends' product management role interfaces with that structure.",
    tags: ["product management", "roadmap", "backlog", "federal", "agile"]
  },
  {
    id: crypto.randomUUID(),
    title: "FFTC Stakeholder Management Approach",
    category: "product",
    body: "Federal contracts involve more stakeholders than most commercial products. The Contracting Officer's Representative oversees contract performance. Program staff have domain expertise and policy constraints. IT security reviews changes before they deploy. Legal reviews content before it publishes. End users have needs that none of the above fully understand. The product manager's job includes navigating all of these relationships without letting any one of them derail the work.\n\nStakeholder identification happens at the beginning of the contract, not when a new voice appears unexpectedly in a review meeting. Friends maps stakeholders by their influence on decisions, their proximity to the work, and their stake in outcomes. Different stakeholders receive different kinds of communication: detailed technical updates for engineering leads, outcome summaries for program directors, compliance documentation for security and legal reviewers.\n\nCommunication rhythms are established early and maintained. Weekly status updates keep the COR informed without requiring ad hoc requests. Sprint reviews include agency stakeholders who can provide feedback on working software rather than responding to documentation about software they have not seen. Regular retrospectives surface process problems before they accumulate.\n\nDisagreements between stakeholders are resolved through evidence rather than authority. When program staff and users disagree about what an interface should do, research findings determine the answer. When engineering constraints conflict with design intent, the product manager facilitates the conversation that produces the best available solution rather than defaulting to one perspective.",
    customizationNotes: "If the contract has specific stakeholder governance requirements (change advisory board, steering committee, regular program reviews), describe how Friends' stakeholder management approach accommodates those requirements.",
    tags: ["stakeholder management", "COR", "federal", "product management", "communication"]
  },
  {
    id: crypto.randomUUID(),
    title: "FFTC Agile Ceremonies Approach",
    category: "agile",
    body: "Agile ceremonies are communication tools. They exist to keep the team aligned, surface problems early, and give stakeholders visibility into progress. Ceremonies that do not serve those functions are overhead. Friends structures ceremonies around what the team and the agency actually need to know, not around a methodology checklist.\n\nSprint planning establishes shared understanding before work begins. The team reviews upcoming work together, raises feasibility concerns, identifies dependencies, and commits to a sprint goal that is specific enough to be evaluated at the end of two weeks. A sprint goal stated as working on authentication is not a sprint goal. A sprint goal stated as completing the login flow through password reset so the COR can review in the sprint demo is.\n\nDaily stand-ups surface blockers, not status. Reporting what you did yesterday and what you will do today is useful only insofar as it reveals something the team needs to act on. Stand-ups that run more than 15 minutes have become something other than stand-ups. Friends keeps them short and redirects extended conversations to follow-up sessions with the relevant people.\n\nSprint reviews demonstrate working software to agency stakeholders. A review that presents slides about what was built is not a sprint review. Agency stakeholders should be able to see and interact with the work that was completed. Their feedback at this stage is more valuable and less expensive than feedback after the project is over.\n\nRetrospectives address the process, not the people. What slowed the team down? What would we do differently? What should we keep doing? These questions are answered in a format that produces action items, not just observations.",
    customizationNotes: "If the contract requires specific reporting cadences (monthly status reports, quarterly program reviews), describe how the agile ceremony structure feeds into those reporting requirements. If the agency has an existing agile practice the team is joining, describe how Friends adapts to that context.",
    tags: ["agile", "ceremonies", "sprints", "scrum", "product", "delivery"]
  },
  {
    id: crypto.randomUUID(),
    title: "FFTC Delivery Management Approach",
    category: "delivery",
    body: "Delivery management on federal contracts means keeping the work moving without losing track of what the work is for. The delivery manager owns the schedule, the risks, the dependencies, and the communication overhead that would otherwise fall on the people closest to the work. This separation is deliberate. Engineers and designers do better work when they are not also managing stakeholder calendars and tracking action items from the last program review.\n\nRisk management is prospective, not reactive. Friends maintains a live risk log that is reviewed and updated at the beginning of each sprint. Risks are not logged and forgotten — they are assigned owners, given likelihood and impact ratings, and tracked until they are either mitigated or accepted. A risk that appears in a risk log but has no mitigation plan is a risk that has been documented rather than managed.\n\nDependencies between teams, between systems, and between workstreams are mapped at the beginning of the project and updated as the work evolves. A dependency that surfaces as a blocker in week eight was usually visible in week two. Friends identifies dependencies early enough to negotiate them rather than work around them at the last moment.\n\nFinancial health is monitored throughout the contract. Burn rate against budget, hours by role, and projected completion against available funding are reviewed weekly. The COR receives financial updates as part of the regular status communication rather than in response to a question about whether the contract is on track.\n\nSchedule management accounts for the actual pace of federal work. Security reviews take time. Stakeholder availability is constrained. Change requests require documentation. Friends builds schedules that accommodate these realities rather than optimistic schedules that require everything to go right.",
    customizationNotes: "If the contract has specific program management reporting requirements (EVM, monthly status reports, specific deliverable milestones), describe how the delivery management approach produces those outputs. If the contract involves subcontractors, add a sentence about subcontractor coordination and performance monitoring.",
    tags: ["delivery management", "program management", "risk", "schedule", "federal"]
  },
  {
    id: crypto.randomUUID(),
    title: "FFTC Program Management Approach",
    category: "delivery",
    body: "Program management at Friends addresses the level above individual project delivery. Where delivery management keeps a single engagement on track, program management coordinates across multiple workstreams, manages the relationships between them, and ensures that decisions made in one workstream do not create problems in another.\n\nProgram-level planning establishes the sequencing logic that individual sprint plans depend on. Some work must happen before other work can start. Some work can proceed in parallel. Some work has external dependencies — agency approvals, third-party integrations, policy decisions — that constrain when it can begin. Program planning maps those relationships so the team can see the critical path and protect it.\n\nGovernance structures at the program level serve a different function than at the project level. Steering committees and executive sponsors make decisions that individual program staff cannot. Program reviews surface strategic risks and trade-offs that require leadership input. Friends prepares for these conversations with the data and options the decision-makers need, not with status reports designed to demonstrate that work is happening.\n\nKnowledge management across a program prevents teams from solving the same problems independently. Design patterns developed in one workstream are made available to other workstreams. Research findings relevant to multiple teams are synthesized and distributed. Technical decisions made for one component are documented in a way that informs related decisions elsewhere.\n\nTransition planning at the program level ensures continuity when personnel change, contracts end, or workstreams are handed to other teams. The program is not dependent on any individual to keep running. Documentation, runbooks, and institutional knowledge are maintained as program assets, not in the heads of the people currently on the work.",
    customizationNotes: "This approach applies to contracts where Friends is managing multiple workstreams or coordinating with multiple agency offices or contractors. For single-team engagements, use the Delivery Management standard approach instead. If the program involves a specific governance structure, name it.",
    tags: ["program management", "delivery", "governance", "coordination", "federal"]
  }
]

// POST - Seed standard approaches into content library
export async function POST() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get the company
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!company) {
    return NextResponse.json({ error: 'No company found' }, { status: 404 })
  }

  // Get existing content library
  const { data: settings } = await supabase
    .from('company_settings')
    .select('content_library')
    .eq('company_id', company.id)
    .single()

  const contentLibrary = (settings?.content_library || {}) as Record<string, unknown>
  const existingApproaches = (contentLibrary.standardApproaches || []) as { id: string; title: string }[]

  console.log(`[seed-standard-approaches] Before: ${existingApproaches.length} existing approaches`)

  // Filter out duplicates by title
  const existingTitles = new Set(existingApproaches.map(a => a.title))
  const newApproaches = STANDARD_APPROACHES.filter(a => !existingTitles.has(a.title))

  console.log(`[seed-standard-approaches] Adding ${newApproaches.length} new approaches (${STANDARD_APPROACHES.length - newApproaches.length} already exist)`)

  const merged = [...existingApproaches, ...newApproaches]

  // Save back
  const { error: updateError } = await supabase
    .from('company_settings')
    .update({
      content_library: {
        ...contentLibrary,
        standardApproaches: merged,
      },
    })
    .eq('company_id', company.id)

  if (updateError) {
    console.error('[seed-standard-approaches] Save failed:', updateError)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({
    before: existingApproaches.length,
    added: newApproaches.length,
    after: merged.length,
    skipped: STANDARD_APPROACHES.length - newApproaches.length,
  })
}
