import { z } from "zod";

export const leadFormSchema = z.object({
  firstName: z.string().min(1, "Required").max(120),
  lastName: z.string().min(1, "Required").max(120),
  email: z.string().email("Enter a valid email"),
  phone: z.string().max(40).optional().or(z.literal("")),
  jobTitle: z.string().max(160).optional().or(z.literal("")),
  message: z.string().max(4000).optional().or(z.literal("")),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;
