import z from 'zod/v4';

export const cliSchema = z.object({
  importPath: z.string(),
  target: z.array(z.string({ message: 'Must be a glob pattern' })),
  targetComponent: z.string().optional(),
  props: z.string().optional(),
});

export type CliOptions = z.infer<typeof cliSchema>;
