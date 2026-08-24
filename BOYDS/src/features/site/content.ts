/**
 * BOYD'S public website content.
 *
 * EVERY CLAIM ON THIS PAGE MUST BE TRUE.
 *
 * BOYD'S is a real company with one van. The website says so. It does not claim
 * certifications BOYD'S has not obtained, offices BOYD'S does not have, fleet
 * size BOYD'S does not operate, or superlatives nobody has verified.
 *
 * This is not caution for its own sake. A medical courier claiming compliance it
 * does not hold, or an insurance level it does not carry, is making a
 * representation a customer may rely on — and BOYD'S would be liable for it.
 * See docs/WEBSITE.md and business rules 34 to 36.
 *
 * A standing guard test scans this file for prohibited claims.
 */

export const POSITIONING = {
  headline: "Reliable Logistics. When Your Business Can't Wait.",
  subheadline:
    'Same-day and scheduled delivery for businesses across North Carolina. Dedicated van service from a team that answers the phone.',
} as const;

export interface Service {
  readonly slug: string;
  readonly name: string;
  readonly summary: string;
  readonly whoItIsFor: string;
  readonly whatWeDo: readonly string[];
  readonly metaDescription: string;
}

/**
 * The services BOYD'S actually offers.
 *
 * Medical courier is described as what it is — careful, direct transport by a
 * named driver. It does not claim certification, compliance, temperature
 * control, or chain-of-custody accreditation, because BOYD'S has not verified
 * holding any of those. What BOYD'S will and will not carry is an open business
 * decision.
 */
export const SERVICES: readonly Service[] = [
  {
    slug: 'same-day-delivery',
    name: 'Same Day Delivery',
    summary:
      'Collected and delivered the same day, across North Carolina and neighbouring states.',
    whoItIsFor:
      'Businesses with something that has to be somewhere today — a part, a document, a replacement.',
    whatWeDo: [
      'Direct collection and delivery, without a depot or a sorting hub in between',
      'One driver from collection to delivery',
      'Proof of delivery captured at the door',
      'A phone number that reaches the people running the job',
    ],
    metaDescription:
      "Same day delivery across North Carolina. BOYD'S Logistics collects and delivers direct, with proof of delivery and a named driver.",
  },
  {
    slug: 'urgent-business-delivery',
    name: 'Urgent Business Delivery',
    summary: 'When a delayed part or document costs more than the delivery does.',
    whoItIsFor:
      'Operations, service and production teams facing a line down, a job stopped, or a deadline in hours.',
    whatWeDo: [
      'Straight to the collection point on confirmation',
      'Direct routing with no consolidation',
      'Updated as the job progresses',
      'Proof of delivery on completion',
    ],
    metaDescription:
      'Urgent business delivery in North Carolina. Direct, dedicated transport when a delay costs more than the delivery.',
  },
  {
    slug: 'dedicated-van-delivery',
    name: 'Dedicated Van Delivery',
    summary: 'The whole van, for your load only.',
    whoItIsFor:
      'Businesses moving something that should not share space, be handled twice, or wait for a route to fill.',
    whatWeDo: [
      'Exclusive use of the vehicle for your consignment',
      'Loaded once, unloaded once',
      'Multiple collections or drops on one run where it suits the job',
      'A route built around your timings',
    ],
    metaDescription:
      'Dedicated van delivery across North Carolina. Exclusive use of the vehicle for your load.',
  },
  {
    slug: 'medical-courier',
    name: 'Medical Courier',
    summary:
      'Careful, direct transport for healthcare businesses, handled by a named driver.',
    whoItIsFor:
      'Clinics, laboratories, practices and suppliers moving items between sites.',
    whatWeDo: [
      'Direct point-to-point transport with no intermediate handling',
      'One named driver for the whole journey',
      'Proof of delivery, with the recipient recorded by name',
      'Timings agreed before the job starts',
    ],
    metaDescription:
      'Medical courier service in North Carolina. Direct transport between healthcare sites with named-driver handling.',
  },
  {
    slug: 'industrial-parts-delivery',
    name: 'Industrial Parts Delivery',
    summary: 'Getting the part to the plant, the site or the technician.',
    whoItIsFor:
      'Manufacturers, suppliers, service businesses and contractors needing a part moved now.',
    whatWeDo: [
      'Collection direct from your supplier, warehouse or branch',
      'Delivery to the plant, the site or the technician',
      'Handling suited to what is being moved',
      'Proof of delivery at the point of handover',
    ],
    metaDescription:
      'Industrial parts delivery across North Carolina. Direct collection and delivery to plants, sites and technicians.',
  },
  {
    slug: 'distribution-and-supply',
    name: 'Distribution & Supply',
    summary: 'Scheduled runs that keep stock where it needs to be.',
    whoItIsFor:
      'Businesses moving goods between their own locations, or out to customers, on a regular pattern.',
    whatWeDo: [
      'Scheduled collections and deliveries on an agreed pattern',
      'Multiple drops on one run',
      'A consistent driver who learns your sites',
      'Records of every run, kept for you',
    ],
    metaDescription:
      'Distribution and supply runs across North Carolina. Scheduled multi-drop delivery for businesses.',
  },
  {
    slug: 'business-logistics',
    name: 'Business Logistics',
    summary: 'Ongoing delivery support for businesses that move things regularly.',
    whoItIsFor:
      'Businesses that would rather one transport partner learned how they work than book a different courier each time.',
    whatWeDo: [
      'Regular scheduled work on an agreed pattern',
      'Same-day capacity for the things that could not be planned',
      'One point of contact who knows your account',
      'Clear records of what moved, when, and what it cost',
    ],
    metaDescription:
      'Business logistics support across North Carolina. Scheduled and same-day delivery from one transport partner.',
  },
] as const;

/**
 * Where BOYD'S serves.
 *
 * Described as a service area, never as an office. BOYD'S has no premises in
 * these cities and the website does not imply otherwise.
 */
export interface ServiceArea {
  readonly slug: string;
  readonly city: string;
  readonly state: string;
  readonly description: string;
}

export const SERVICE_AREAS: readonly ServiceArea[] = [
  {
    slug: 'charlotte',
    city: 'Charlotte',
    state: 'NC',
    description:
      'Charlotte and the surrounding Mecklenburg County area, including the industrial and distribution corridors around the city.',
  },
  {
    slug: 'concord',
    city: 'Concord',
    state: 'NC',
    description: 'Concord, Kannapolis and the Cabarrus County area.',
  },
  {
    slug: 'greensboro',
    city: 'Greensboro',
    state: 'NC',
    description: 'Greensboro and the surrounding Guilford County area.',
  },
  {
    slug: 'winston-salem',
    city: 'Winston-Salem',
    state: 'NC',
    description: 'Winston-Salem and the Forsyth County area.',
  },
  {
    slug: 'raleigh',
    city: 'Raleigh',
    state: 'NC',
    description: 'Raleigh, Cary and the wider Wake County area.',
  },
  {
    slug: 'durham',
    city: 'Durham',
    state: 'NC',
    description: 'Durham and the Research Triangle area.',
  },
  {
    slug: 'fayetteville',
    city: 'Fayetteville',
    state: 'NC',
    description: 'Fayetteville and the Cumberland County area.',
  },
] as const;

export const FAQ: readonly { question: string; answer: string }[] = [
  {
    question: 'What areas do you cover?',
    answer:
      'BOYD’S Logistics is based in North Carolina and serves businesses across the state, including Charlotte, Concord, Greensboro, Winston-Salem, Raleigh, Durham and Fayetteville. We also take work into neighbouring states. If you are not sure whether your route suits us, ask — we will tell you honestly.',
  },
  {
    question: 'How much does a delivery cost?',
    answer:
      'It depends on the distance, the timing and what is being moved, so we quote each job rather than publishing a rate card that would be wrong for most of them. Send us the details and we will come back with a price.',
  },
  {
    question: 'How quickly can you collect?',
    answer:
      'That depends on where the vehicle is and what is already scheduled. Rather than promise a time we cannot verify, we will tell you what we can actually do when you contact us.',
  },
  {
    question: 'Can I request a delivery outside working hours?',
    answer:
      'Yes. You can submit a request through this site at any time, day or night. It reaches us immediately and we respond as soon as we are able. A request is not a confirmed booking until we have come back to you and agreed it.',
  },
  {
    question: 'Do you provide proof of delivery?',
    answer:
      'Yes. Every delivery is signed for or photographed at the point of handover, with the recipient recorded by name and the time captured automatically.',
  },
  {
    question: 'Do you handle medical deliveries?',
    answer:
      'We carry items for healthcare businesses on a direct, point-to-point basis with a named driver and proof of delivery. What we will and will not carry depends on the item — please tell us exactly what needs moving and we will tell you straight whether it is something we can handle.',
  },
  {
    question: 'How large is your fleet?',
    answer:
      'BOYD’S Logistics currently operates one van, and we are direct about that. It means the person who collects your delivery is the person who delivers it, and you deal with the people running the business rather than a call centre.',
  },
] as const;
