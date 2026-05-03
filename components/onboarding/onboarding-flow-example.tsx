"use client";

/**
 * Standalone multi-step form demo ported from the integration bundle’s App.tsx.
 * For design review / QA only — not used by production onboarding (`OnboardingWizard`).
 */
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Briefcase, Check, ChevronLeft, ChevronRight, Palette, Target, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Step {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface FormData {
  name: string;
  email: string;
  company: string;
  role: string;
  experience: string;
  goals: string[];
  budget: string;
  timeline: string;
  preferences: string;
  additionalInfo: string;
}

const steps: Step[] = [
  {
    id: 1,
    title: "Personal Info",
    description: "Tell us about yourself",
    icon: <User className="h-5 w-5" />,
  },
  {
    id: 2,
    title: "Professional",
    description: "Your work background",
    icon: <Briefcase className="h-5 w-5" />,
  },
  {
    id: 3,
    title: "Goals",
    description: "What you want to achieve",
    icon: <Target className="h-5 w-5" />,
  },
  {
    id: 4,
    title: "Preferences",
    description: "Your style and budget",
    icon: <Palette className="h-5 w-5" />,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
  exit: { opacity: 0 },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" as const },
  },
};

export function OnboardingFlowExample() {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [isComplete, setIsComplete] = React.useState(false);
  const [formData, setFormData] = React.useState<FormData>({
    name: "",
    email: "",
    company: "",
    role: "",
    experience: "",
    goals: [],
    budget: "",
    timeline: "",
    preferences: "",
    additionalInfo: "",
  });

  const updateFormData = (field: keyof FormData, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleGoal = (goal: string) => {
    setFormData((prev) => {
      const goals = [...prev.goals];
      if (goals.includes(goal)) {
        return { ...prev, goals: goals.filter((g) => g !== goal) };
      }
      return { ...prev, goals: [...goals, goal] };
    });
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setIsComplete(true);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 0:
        return formData.name.trim() !== "" && formData.email.trim() !== "";
      case 1:
        return formData.role.trim() !== "" && formData.experience !== "";
      case 2:
        return formData.goals.length > 0;
      case 3:
        return formData.budget !== "" && formData.timeline !== "";
      default:
        return true;
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  if (isComplete) {
    return (
      <div className="flex min-h-[100vh] items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-md"
        >
          <Card className="border-2 shadow-xl">
            <CardContent className="pt-12 pb-12">
              <div className="flex flex-col items-center gap-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 220 }}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"
                >
                  <Check className="h-10 w-10 text-primary" strokeWidth={3} />
                </motion.div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold">Welcome aboard, {formData.name}!</h2>
                  <p className="text-muted-foreground">
                    Your onboarding is complete. We&apos;re excited to have you here.
                  </p>
                </div>
                <Button size="lg" className="mt-4" onClick={() => window.location.reload()}>
                  Get Started
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100vh] items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="mb-6 flex items-center justify-between gap-1">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <motion.button
                  type="button"
                  onClick={() => index <= currentStep && setCurrentStep(index)}
                  disabled={index > currentStep}
                  className={cn(
                    "group relative flex flex-col items-center gap-2 transition-all",
                    index > currentStep && "cursor-not-allowed opacity-40"
                  )}
                  whileHover={index <= currentStep ? { scale: 1.04 } : undefined}
                  whileTap={index <= currentStep ? { scale: 0.96 } : undefined}
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-300",
                      index < currentStep && "border-primary bg-primary text-primary-foreground",
                      index === currentStep &&
                        "border-primary bg-primary text-primary-foreground shadow-lg",
                      index > currentStep && "border-muted bg-background text-muted-foreground"
                    )}
                  >
                    {index < currentStep ? <Check className="h-5 w-5" strokeWidth={3} /> : step.icon}
                  </div>
                  <div className="hidden text-center sm:block">
                    <p
                      className={cn(
                        "text-xs font-medium",
                        index === currentStep ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {step.title}
                    </p>
                  </div>
                </motion.button>
                {index < steps.length - 1 ? (
                  <div className="relative mx-1 h-0.5 min-w-[12px] flex-1 rounded bg-muted">
                    <motion.div
                      className="absolute inset-y-0 start-0 bg-primary"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: index < currentStep ? 1 : 0 }}
                      transition={{ duration: 0.28 }}
                      style={{ transformOrigin: "left", width: "100%" }}
                    />
                  </div>
                ) : null}
              </React.Fragment>
            ))}
          </div>

          <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            />
          </div>
        </motion.div>

        <Card className="shadow-lg">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <CardHeader>
                <motion.div variants={itemVariants}>
                  <CardTitle className="text-2xl">{steps[currentStep].title}</CardTitle>
                  <CardDescription className="text-base">
                    {steps[currentStep].description}
                  </CardDescription>
                </motion.div>
              </CardHeader>

              <CardContent className="space-y-6">
                {currentStep === 0 ? (
                  <>
                    <motion.div variants={itemVariants} className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={(e) => updateFormData("name", e.target.value)}
                        className="h-11"
                      />
                    </motion.div>
                    <motion.div variants={itemVariants} className="space-y-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={(e) => updateFormData("email", e.target.value)}
                        className="h-11"
                      />
                    </motion.div>
                    <motion.div variants={itemVariants} className="space-y-2">
                      <Label htmlFor="company">Company (Optional)</Label>
                      <Input
                        id="company"
                        placeholder="Your Company"
                        value={formData.company}
                        onChange={(e) => updateFormData("company", e.target.value)}
                        className="h-11"
                      />
                    </motion.div>
                  </>
                ) : null}

                {currentStep === 1 ? (
                  <>
                    <motion.div variants={itemVariants} className="space-y-2">
                      <Label htmlFor="role">Your Role *</Label>
                      <Input
                        id="role"
                        placeholder="e.g. Designer, Developer, Manager"
                        value={formData.role}
                        onChange={(e) => updateFormData("role", e.target.value)}
                        className="h-11"
                      />
                    </motion.div>
                    <motion.div variants={itemVariants} className="space-y-2">
                      <Label htmlFor="experience">Experience Level *</Label>
                      <Select
                        value={formData.experience}
                        onValueChange={(value) => updateFormData("experience", value)}
                      >
                        <SelectTrigger id="experience" className="h-11 w-full">
                          <SelectValue placeholder="Select your experience" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner (0-2 years)</SelectItem>
                          <SelectItem value="intermediate">Intermediate (2-5 years)</SelectItem>
                          <SelectItem value="advanced">Advanced (5-10 years)</SelectItem>
                          <SelectItem value="expert">Expert (10+ years)</SelectItem>
                        </SelectContent>
                      </Select>
                    </motion.div>
                  </>
                ) : null}

                {currentStep === 2 ? (
                  <motion.div variants={itemVariants} className="space-y-3">
                    <Label>What are your main goals? *</Label>
                    <div className="grid gap-3">
                      {[
                        "Build a portfolio",
                        "Launch a product",
                        "Grow my business",
                        "Learn new skills",
                        "Connect with others",
                      ].map((goal, index) => (
                        <motion.div
                          key={goal}
                          variants={itemVariants}
                          className="flex cursor-pointer items-center space-x-3 rounded-lg border p-4 transition-colors hover:bg-accent"
                          onClick={() => toggleGoal(goal)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleGoal(goal);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <Checkbox
                            id={`goal-${index}`}
                            checked={formData.goals.includes(goal)}
                            onCheckedChange={() => toggleGoal(goal)}
                          />
                          <Label htmlFor={`goal-${index}`} className="flex-1 cursor-pointer font-normal">
                            {goal}
                          </Label>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ) : null}

                {currentStep === 3 ? (
                  <>
                    <motion.div variants={itemVariants} className="space-y-2">
                      <Label htmlFor="budget">Budget Range *</Label>
                      <Select value={formData.budget} onValueChange={(value) => updateFormData("budget", value)}>
                        <SelectTrigger id="budget" className="h-11 w-full">
                          <SelectValue placeholder="Select your budget" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="under-1000">Under $1,000</SelectItem>
                          <SelectItem value="1000-5000">$1,000 - $5,000</SelectItem>
                          <SelectItem value="5000-10000">$5,000 - $10,000</SelectItem>
                          <SelectItem value="over-10000">Over $10,000</SelectItem>
                        </SelectContent>
                      </Select>
                    </motion.div>
                    <motion.div variants={itemVariants} className="space-y-2">
                      <Label>Timeline *</Label>
                      <RadioGroup
                        value={formData.timeline}
                        onValueChange={(value) => updateFormData("timeline", value)}
                        className="space-y-2"
                      >
                        {[
                          { value: "asap", label: "ASAP" },
                          { value: "1-month", label: "Within 1 month" },
                          { value: "3-months", label: "1-3 months" },
                          { value: "flexible", label: "Flexible" },
                        ].map((option) => (
                          <div
                            key={option.value}
                            className="flex cursor-pointer items-center space-x-3 rounded-lg border p-4 transition-colors hover:bg-accent"
                          >
                            <RadioGroupItem value={option.value} id={option.value} />
                            <Label htmlFor={option.value} className="flex-1 cursor-pointer font-normal">
                              {option.label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </motion.div>
                    <motion.div variants={itemVariants} className="space-y-2">
                      <Label htmlFor="additionalInfo">Additional Information</Label>
                      <Textarea
                        id="additionalInfo"
                        placeholder="Tell us anything else we should know..."
                        value={formData.additionalInfo}
                        onChange={(e) => updateFormData("additionalInfo", e.target.value)}
                        className="min-h-[100px]"
                      />
                    </motion.div>
                  </>
                ) : null}
              </CardContent>

              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={handleBack} disabled={currentStep === 0} className="gap-2">
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleNext} disabled={!isStepValid()} className="gap-2">
                  {currentStep === steps.length - 1 ? (
                    <>
                      Complete
                      <Check className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </motion.div>
          </AnimatePresence>
        </Card>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="mt-4 text-center text-sm text-muted-foreground"
        >
          Step {currentStep + 1} of {steps.length}
        </motion.p>
      </div>
    </div>
  );
}
