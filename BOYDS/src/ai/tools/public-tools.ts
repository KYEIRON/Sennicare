/**
 * Tools the PUBLIC AI receptionist may use.
 *
 * This registry is the complete list of what an anonymous visitor's AI can
 * reach. It contains no pricing, no availability, no customer data, no job
 * data, and no financial data — not because those are denied, but because they
 * are absent.
 */

import 'server-only';

import { z } from 'zod';
import { SERVICES, SERVICE_AREAS, FAQ } from '@/features/site/content';
import type { AiTool, ToolRegistry } from './types';

const getServices: AiTool<Record<string, never>> = {
  name: 'get_services',
  description: "The services BOYD'S offers, and who each one is for.",
  schema: z.object({}),
  minimumRole: null,
  async execute() {
    return SERVICES.map((service) => ({
      name: service.name,
      summary: service.summary,
      whoItIsFor: service.whoItIsFor,
      howItWorks: service.whatWeDo,
    }));
  },
};

const getServiceAreas: AiTool<Record<string, never>> = {
  name: 'get_service_areas',
  description: "Where BOYD'S delivers. These are service areas, not offices.",
  schema: z.object({}),
  minimumRole: null,
  async execute() {
    return {
      state: 'North Carolina',
      areas: SERVICE_AREAS.map((area) => `${area.city}, ${area.state}`),
      note: "BOYD'S also takes work into neighbouring states. It has no premises in these cities.",
    };
  },
};

const getFaq: AiTool<Record<string, never>> = {
  name: 'get_faq',
  description: "Answers BOYD'S has already given to common questions.",
  schema: z.object({}),
  minimumRole: null,
  async execute() {
    return FAQ;
  },
};

const jobRequestInput = z.object({
  contactName: z.string().min(1),
  companyName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  pickupAddress: z.string().min(1),
  pickupCity: z.string().optional(),
  pickupState: z.string().optional(),
  pickupZip: z.string().optional(),
  deliveryAddress: z.string().min(1),
  deliveryCity: z.string().optional(),
  deliveryState: z.string().optional(),
  deliveryZip: z.string().optional(),
  description: z.string().optional(),
  pickupDate: z.string().optional(),
  pickupTime: z.string().optional(),
  urgency: z.enum(['STANDARD', 'SCHEDULED', 'SAME_DAY', 'URGENT', 'CRITICAL']).optional(),
  isRecurring: z.boolean().optional(),
  notes: z.string().optional(),
});

const createJobRequest: AiTool<z.infer<typeof jobRequestInput>> = {
  name: 'create_job_request',
  description:
    "Record a delivery request for the BOYD'S team to review. This does NOT book or confirm anything. Only call it once the customer has given at least a name, a way to reply, and both addresses.",
  schema: jobRequestInput,
  minimumRole: null,
  async execute(input, context) {
    const { data, error } = await context.client.rpc('create_public_job_request', {
      p_company_name: input.companyName ?? null,
      p_contact_name: input.contactName,
      p_contact_email: input.contactEmail ?? null,
      p_contact_phone: input.contactPhone ?? null,
      p_pickup_address: input.pickupAddress,
      p_pickup_city: input.pickupCity ?? null,
      p_pickup_state: input.pickupState ?? null,
      p_pickup_zip: input.pickupZip ?? null,
      p_delivery_address: input.deliveryAddress,
      p_delivery_city: input.deliveryCity ?? null,
      p_delivery_state: input.deliveryState ?? null,
      p_delivery_zip: input.deliveryZip ?? null,
      p_description: input.description ?? null,
      p_pickup_date: input.pickupDate ?? null,
      p_pickup_time: input.pickupTime ?? null,
      p_urgency: input.urgency ?? null,
      p_is_recurring: input.isRecurring ?? false,
      p_source: 'AI_RECEPTIONIST',
      p_notes: input.notes ?? null,
    });

    if (error) {
      return {
        recorded: false,
        message:
          'The request could not be recorded. Tell the customer to call or use the request form instead — do not tell them it went through.',
      };
    }

    return {
      recorded: true,
      reference: String(data),
      message:
        "Tell the customer their request has been received and will be reviewed by the BOYD'S team. It is NOT a confirmed booking.",
    };
  },
};

export const publicTools: ToolRegistry = {
  get_services: getServices as AiTool<never>,
  get_service_areas: getServiceAreas as AiTool<never>,
  get_faq: getFaq as AiTool<never>,
  create_job_request: createJobRequest as AiTool<never>,
};
