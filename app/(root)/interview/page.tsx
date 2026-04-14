// Interview generation: standard uses JSON POST; resume-based sends a PDF via multipart to `/api/vapi/generate`.

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { MAX_PDF_BYTES } from "@/lib/rag/constants";
import { COMPANY_JDS } from "@/constants";

const formSchema = z.object({
  mode: z.enum(["standard", "resume"]),
  role: z.string().min(2, {
    message: "Role must be at least 2 characters.",
  }),
  type: z.string().min(2, {
    message: "Type must be at least 2 characters.",
  }),
  level: z.string().min(2, {
    message: "Level must be at least 2 characters.",
  }),
  techstack: z.string().min(2, {
    message: "Tech stack must be at least 2 characters.",
  }),
  amount: z.coerce.number().min(1).max(10),
  companyType: z.string().optional(),
  customJD: z.string().optional(),
});

export type InterviewFormValues = z.output<typeof formSchema>;

const InterviewGenerationPage = () => {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resumePdf, setResumePdf] = useState<File | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const user = await getCurrentUser();
      setUserId(user?.id ?? null);
    };
    fetchUser();
  }, []);

  const form = useForm<InterviewFormValues>({
    resolver: zodResolver(formSchema) as Resolver<InterviewFormValues>,
    defaultValues: {
      mode: "standard",
      role: "",
      type: "technical",
      level: "junior",
      techstack: "",
      amount: 5,
      companyType: "",
      customJD: "",
    },
  });

  const mode = form.watch("mode");

  useEffect(() => {
    if (mode === "standard") setResumePdf(null);
  }, [mode]);

  function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".pdf")) {
      toast.error("Please upload a PDF file (.pdf).");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      toast.error(
        `PDF must be under ${Math.round(MAX_PDF_BYTES / (1024 * 1024))} MB.`
      );
      e.target.value = "";
      return;
    }
    setResumePdf(file);
    toast.success(`Selected: ${file.name}`);
    e.target.value = "";
  }

  async function onSubmit(values: InterviewFormValues) {
    if (!userId) {
      toast.error("You must be logged in to create an interview.");
      return;
    }

    if (values.mode === "resume" && !resumePdf) {
      toast.error("Upload your resume as a PDF.");
      return;
    }

    const jobDescription =
      values.customJD?.trim() ||
      COMPANY_JDS[values.companyType?.trim() || ""] ||
      "";

    setIsSubmitting(true);
    try {
      if (values.mode === "resume" && resumePdf) {
        const fd = new FormData();
        fd.append("mode", "resume");
        fd.append("type", values.type);
        fd.append("role", values.role);
        fd.append("level", values.level);
        fd.append("techstack", values.techstack);
        fd.append("amount", String(values.amount));
        fd.append("userid", userId);
        fd.append("companyType", values.companyType?.trim() || "");
        fd.append("jobDescription", jobDescription);
        fd.append("resumePdf", resumePdf);

        const response = await fetch("/api/vapi/generate", {
          method: "POST",
          body: fd,
        });

        const result = await response.json();

        if (response.ok && result.success) {
          toast.success("Interview created successfully!");
          router.push(`/interview/${result.interviewId}`);
        } else {
          toast.error("Failed to create interview.", {
            description: result.error || "An unknown error occurred.",
          });
        }
      } else {
        const response = await fetch("/api/vapi/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: values.type,
            role: values.role,
            level: values.level,
            techstack: values.techstack,
            amount: values.amount,
            userid: userId,
            companyType: values.companyType?.trim() || "",
            jobDescription,
            mode: "standard",
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          toast.success("Interview created successfully!");
          router.push(`/interview/${result.interviewId}`);
        } else {
          toast.error("Failed to create interview.", {
            description: result.error || "An unknown error occurred.",
          });
        }
      }
    } catch {
      toast.error("Failed to create interview.", {
        description: "An unexpected error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <h3 className="text-2xl font-bold mb-4">Generate New Interview</h3>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="mode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Interview source</FormLabel>
                <FormControl>
                  <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        className="size-4 accent-primary"
                        checked={field.value === "standard"}
                        onChange={() => field.onChange("standard")}
                      />
                      <span>Standard (role & tech stack only)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        className="size-4 accent-primary"
                        checked={field.value === "resume"}
                        onChange={() => field.onChange("resume")}
                      />
                      <span>Based on your resume (PDF + RAG + Groq)</span>
                    </label>
                  </div>
                </FormControl>
              
                <FormMessage />
              </FormItem>
            )}
          />

          {mode === "resume" && (
            <FormItem>
              <FormLabel>Resume (PDF)</FormLabel>
              <FormControl>
                <Input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="cursor-pointer max-w-md"
                  onChange={handlePdfChange}
                />
              </FormControl>
              <FormDescription>
                Text-based PDFs work best. Scanned images need OCR elsewhere
                first. Max {Math.round(MAX_PDF_BYTES / (1024 * 1024))} MB.
              </FormDescription>
              {resumePdf && (
                <p className="text-sm text-muted-foreground">
                  Selected: {resumePdf.name}
                </p>
              )}
            </FormItem>
          )}

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job Role</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Software Engineer" {...field} />
                </FormControl>
                <FormDescription>
                  The role you are interviewing for.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Interview Type</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., technical" {...field} />
                </FormControl>
                <FormDescription>
                  Focus of the interview, e.g., &apos;technical&apos; or
                  &apos;behavioural&apos;.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="level"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Experience Level</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., junior" {...field} />
                </FormControl>
                <FormDescription>
                  e.g., &apos;entry-level&apos;, &apos;junior&apos;,
                  &apos;mid-level&apos;, &apos;senior&apos;.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="techstack"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tech Stack</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., React, Node.js, TypeScript"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Comma-separated list of technologies.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Number of Questions</FormLabel>
                <FormControl>
                  <Input type="number" min="1" max="10" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="companyType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Profile (for Cultural & Role Fit)</FormLabel>
                <FormControl>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={field.value || ""}
                    onChange={field.onChange}
                  >
                    <option value="">Select company profile (optional)</option>
                    <option value="google">Google-style</option>
                    <option value="startup">Startup-style</option>
                    <option value="corporate">Corporate-style</option>
                  </select>
                </FormControl>
                <FormDescription>
                  Use a predefined company culture profile, or provide a custom
                  job description below.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="customJD"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Custom Job Description (optional)</FormLabel>
                <FormControl>
                  <textarea
                    className="w-full min-h-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Paste the job description here. If provided, this overrides the company profile."
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  This will be used to evaluate &quot;Cultural &amp; Role
                  Fit&quot; using the final transcript.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Generating..." : "Generate Interview"}
          </Button>
        </form>
      </Form>
      <Toaster />
    </>
  );
};

export default InterviewGenerationPage;
