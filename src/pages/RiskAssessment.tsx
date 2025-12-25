import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "@/lib/firebase"; // SWITCHED TO FIREBASE
import { doc, getDoc } from 'firebase/firestore'; // Firebase methods
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Heart, 
  Droplets, 
  TrendingUp, 
  Shield, 
  Zap, 
  User, 
  FileText, 
  Loader2 
} from "lucide-react";


// --- TypeScript Interfaces (Updated for Firebase) ---
interface PatientProfile {
  name: string;
  age: number;
  gender: string;
  conditions: string[];
  frailty_score: number | null;
  vitals: {
    bp: string;
    hba1c: number;
    glucose: number;
    creatinine: number;
    egfr: number | null;
  } | null;
}

interface RiskFactor {
  name: string;
  value: string | number;
  isRisk: boolean;
}

interface RiskCategory {
  name: string;
  icon: React.ElementType;
  score: number;
  level: 'low' | 'medium' | 'high';
  factors: RiskFactor[];
  summary: string;
}


export default function RiskAssessment() {
  const { patientId } = useParams();
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [assessments, setAssessments] = useState<RiskCategory[]>([]);
  const [overallScore, setOverallScore] = useState(0);

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    const fetchAndAssessRisk = async () => {
      setLoading(true);
      try {
        // Step 1: Fetch Patient and Vitals Data
        const patientDocRef = doc(db, 'patients', patientId);
        const patientDoc = await getDoc(patientDocRef);
        if (!patientDoc.exists()) throw new Error("Patient not found");

        const vitalsDocRef = doc(db, 'vitals', patientId);
        const vitalsDoc = await getDoc(vitalsDocRef);
        const patientData = patientDoc.data() as Omit<PatientProfile, 'vitals'>;
        const vitalsData = vitalsDoc.exists() ? vitalsDoc.data() as PatientProfile['vitals'] : null;

        const fullProfile: PatientProfile = { ...patientData, vitals: vitalsData };
        setPatient(fullProfile);

        // Step 2: Risk Calculation Logic (moved from backend)
        let totalRiskScore = 0;
        const calculatedAssessments: RiskCategory[] = [];

        const { age, gender, conditions, frailty_score, vitals } = fullProfile;
        const systolicBp = vitals?.bp ? parseInt(vitals.bp.split('/')[0]) : 0;
        const hba1c = vitals?.hba1c || 0;
        const egfr = vitals?.egfr || 90;

        // --- Hypoglycemia Risk ---
        let hypoglycemiaScore = 10;
        const hypoglycemiaFactors: RiskFactor[] = [
          { name: "Age", value: age, isRisk: age >= 75 },
          { name: "HbA1c", value: `${hba1c}%`, isRisk: hba1c > 9.0 },
          { name: "eGFR", value: egfr, isRisk: egfr < 45 },
        ];
        if (age >= 75 && hba1c > 8.5) hypoglycemiaScore += 30;
        if (egfr < 45) hypoglycemiaScore += 25;
        if (conditions.includes("Chronic Kidney Disease")) hypoglycemiaScore += 15;
        if (hba1c > 9.0) hypoglycemiaScore += 20;
        hypoglycemiaScore = Math.min(100, hypoglycemiaScore);
        calculatedAssessments.push({
          name: "Hypoglycemia Events",
          icon: Droplets,
          score: hypoglycemiaScore,
          level: hypoglycemiaScore > 60 ? 'high' : hypoglycemiaScore > 30 ? 'medium' : 'low',
          factors: hypoglycemiaFactors,
          summary: "Risk of dangerously low blood sugar due to age, kidney function, and high glucose variability."
        });
        totalRiskScore += hypoglycemiaScore;

        // --- Cardiovascular Risk ---
        let cardioScore = 10;
        const cardioFactors: RiskFactor[] = [
          { name: "Systolic BP", value: `${systolicBp} mmHg`, isRisk: systolicBp >= 140 },
          { name: "Key Conditions", value: conditions.join(", "), isRisk: conditions.includes("Hypertension") || conditions.includes("Coronary Artery Disease") },
          { name: "Age", value: age, isRisk: age > 65 },
        ];
        if (systolicBp >= 160) cardioScore += 30;
        if (conditions.includes("Coronary Artery Disease")) cardioScore += 25;
        if (age > 75) cardioScore += 15;
        if (conditions.includes("Metabolic Syndrome")) cardioScore += 20;
        cardioScore = Math.min(100, cardioScore);
        calculatedAssessments.push({
          name: "Cardiovascular Events",
          icon: Heart,
          score: cardioScore,
          level: cardioScore > 65 ? 'high' : cardioScore > 35 ? 'medium' : 'low',
          factors: cardioFactors,
          summary: "Risk of heart attack or stroke, primarily driven by blood pressure, age, and existing heart conditions."
        });
        totalRiskScore += cardioScore;

        // --- Polypharmacy & Frailty Risk ---
        let frailtyRiskScore = frailty_score ? frailty_score * 20 : 10;
        const frailtyFactors: RiskFactor[] = [
          { name: "Frailty Score", value: frailty_score ?? 'N/A', isRisk: (frailty_score ?? 0) >= 3 },
          { name: "eGFR", value: egfr, isRisk: egfr < 60 },
          { name: "Gender", value: gender, isRisk: false },
        ];
        if (egfr < 60) frailtyRiskScore += 20;
        if (age > 80) frailtyRiskScore += 15;
        frailtyRiskScore = Math.min(100, frailtyRiskScore);
        calculatedAssessments.push({
          name: "Frailty & Adverse Events",
          icon: Zap,
          score: frailtyRiskScore,
          level: frailtyRiskScore > 60 ? 'high' : frailtyRiskScore > 30 ? 'medium' : 'low',
          factors: frailtyFactors,
          summary: "Risk of falls, medication side effects, or hospitalization due to vulnerability and reduced physiological reserve."
        });
        totalRiskScore += frailtyRiskScore;

        setAssessments(calculatedAssessments);
        setOverallScore(Math.round(totalRiskScore / calculatedAssessments.length));

      } catch (error) {
        console.error("Failed to fetch and assess risk:", error);
        setPatient(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAndAssessRisk();
  }, [patientId]);

  const getScoreColor = (level: 'low' | 'medium' | 'high') => {
    if (level === 'high') return "text-risk-high";
    if (level === 'medium') return "text-risk-medium";
    return "text-risk-low";
  };

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /><p className="ml-4">Assessing Patient Risk...</p></div></DashboardLayout>;
  }

  if (!patient || !patientId) {
    return <DashboardLayout><div className="text-center h-full flex flex-col justify-center items-center"><h2 className="text-xl font-semibold">No Patient Selected</h2><p>Please select a patient to view their risk assessment.</p></div></DashboardLayout>;
  }
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">Risk Assessment</h1>
                <p className="text-sm md:text-base text-muted-foreground">Clinical risk profile for <span className="font-semibold text-primary">{patient.name}</span>, {patient.age} y/o {patient.gender}</p>
            </div>
            <Card className="p-4 flex items-center justify-between w-full md:w-auto md:max-w-xs shadow-card">
                <div className="flex-1 mr-4">
                    <p className="text-sm text-muted-foreground">Overall Patient Risk</p>
                    <p className={`text-2xl font-bold ${getScoreColor(overallScore > 65 ? 'high' : overallScore > 35 ? 'medium' : 'low')}`}>{overallScore}%</p>
                </div>
                <Shield className={`w-12 h-12 ${getScoreColor(overallScore > 65 ? 'high' : overallScore > 35 ? 'medium' : 'low')}`} />
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {assessments.map((assessment, index) => (
            <Card key={index} className="p-6 flex flex-col shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold flex items-center ${getScoreColor(assessment.level)}`}><assessment.icon className="w-5 h-5 mr-2" />{assessment.name}</h3>
                <Badge variant={assessment.level === 'high' ? 'destructive' : assessment.level === 'medium' ? 'secondary' : 'default'} className={`text-xs ${assessment.level === 'high' ? 'bg-risk-high-bg text-risk-high' : assessment.level === 'medium' ? 'bg-risk-medium-bg text-risk-medium' : 'bg-risk-low-bg text-risk-low'}`}>{assessment.level.toUpperCase()}</Badge>
              </div>
              <div className="flex items-center gap-4 mb-4">
                  <span className={`text-4xl font-bold ${getScoreColor(assessment.level)}`}>{assessment.score}%</span>
                  <Progress value={assessment.score} className="flex-1" />
              </div>
              <p className="text-sm text-muted-foreground mb-4 flex-grow">{assessment.summary}</p>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Key Risk Factors</h4>
                {assessment.factors.map((factor, fIndex) => (
                   <div key={fIndex} className={`text-xs flex justify-between p-2 rounded-md ${factor.isRisk ? 'bg-muted' : 'bg-muted/50'}`}>
                     <span>{factor.name}</span>
                     <span className={`font-semibold ${factor.isRisk ? 'text-foreground' : 'text-muted-foreground'}`}>{factor.value}</span>
                   </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

         <Card className="p-6 shadow-card">
           <h3 className="text-xl font-semibold mb-4 flex items-center"><TrendingUp className="w-5 h-5 mr-2 text-primary"/>Summary & Recommendations</h3>
           <div className="divide-y divide-border">
            <div className="py-4"> <h4 className="font-medium text-base mb-1">Prioritize Glycemic Control</h4><p className="text-sm text-muted-foreground">High hypoglycemia risk suggests a need for simplified insulin regimens or GLP-1 agonists. Avoid sulfonylureas if eGFR is low. Target HbA1c of 8.0-8.5% is more appropriate than aggressive targets.</p></div>
            <div className="py-4"> <h4 className="font-medium text-base mb-1">Manage Blood Pressure</h4><p className="text-sm text-muted-foreground">For patients over 75, a blood pressure target of 140/90 mmHg is reasonable. Consider ACE inhibitors or ARBs, which are kidney-protective, especially given the patient's cardiovascular risk profile.</p></div>
            <div className="py-4"> <h4 className="font-medium text-base mb-1">Conduct Medication Review</h4><p className="text-sm text-muted-foreground">The combination of frailty and potential polypharmacy increases the risk of adverse drug events. A thorough review to de-prescribe non-essential medications is strongly recommended.</p></div>
           </div>
         </Card>
      </div>
    </DashboardLayout>
  );
}
