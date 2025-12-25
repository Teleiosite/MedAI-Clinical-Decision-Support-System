
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, 
  BarChart3, 
  TrendingUp, 
  Download,
  RefreshCw,
  Eye,
  Lightbulb,
  Loader2
} from "lucide-react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { fetchModelPredictions, fetchFeatureImportance, runSinglePrediction, ModelPrediction, FeatureImportance, PredictionItem } from "@/lib/ml-models";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';

// --- TypeScript Interfaces ---
interface PatientListItem { id: string; name: string; }
interface PatientProfile extends PatientListItem { age: number; gender: string; weight: number; height: number; diabetes_duration: number; htn_duration: number; vitals: { hba1c: number; creatinine: number; bp: string; egfr: number; } | null }

export default function Predictions() {
  const [modelPredictions, setModelPredictions] = useState<ModelPrediction[]>([]);
  const [featureImportance, setFeatureImportance] = useState<FeatureImportance[]>([]);
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedPatient, setSelectedPatient] = useState<PatientProfile | null>(null);
  const [isFetchingPatient, setIsFetchingPatient] = useState(false);

  const [loading, setLoading] = useState(true);
  const [isPredicting, setIsPredicting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const patientsCollection = collection(db, 'patients');
        const [predictions, importance, patientListSnapshot] = await Promise.all([
          fetchModelPredictions(),
          fetchFeatureImportance(),
          getDocs(patientsCollection),
        ]);

        const patientList = patientListSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name as string }));
        setModelPredictions(predictions);
        setFeatureImportance(importance);
        setPatients(patientList.sort((a,b) => a.name.localeCompare(b.name)));

      } catch (error) {
        console.error("Failed to load ML model data or patient list:", error);
        toast({ title: "Error Loading Data", description: "Could not load initial model and patient data.", variant: "destructive"});
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [toast]);

  useEffect(() => {
    const fetchPatientProfile = async () => {
      if (!selectedPatientId) {
        setSelectedPatient(null);
        return;
      }
      setIsFetchingPatient(true);
      try {
        const patientDocRef = doc(db, 'patients', selectedPatientId);
        const patientDoc = await getDoc(patientDocRef);
        if (!patientDoc.exists()) throw new Error("Patient not found");

        const vitalsDocRef = doc(db, 'vitals', selectedPatientId);
        const vitalsDoc = await getDoc(vitalsDocRef);
        const vitalsData = vitalsDoc.exists() ? vitalsDoc.data() as PatientProfile['vitals'] : null;

        setSelectedPatient({ id: patientDoc.id, ...(patientDoc.data() as Omit<PatientProfile, 'id' | 'vitals'>), vitals: vitalsData });
      } catch (error) {
        toast({ title: "Failed to load patient profile", variant: "destructive" });
        setSelectedPatient(null);
      } finally {
        setIsFetchingPatient(false);
      }
    };
    fetchPatientProfile();
  }, [selectedPatientId, toast]);

  const patientFeatureVector = useMemo(() => {
    if (!selectedPatient || !selectedPatient.vitals) return null;

    const { age, gender, weight, height, diabetes_duration, htn_duration, vitals } = selectedPatient;
    const { hba1c, creatinine, bp, egfr } = vitals;
    const [sbp, dbp] = bp ? bp.replace(/\s*mmHg/g, '').split('/').map(Number) : [0, 0];
    const bmi = (weight && height) ? (weight / ((height / 100) ** 2)) : 0;

    return [age || 0, bmi || 0, diabetes_duration || 0, htn_duration || 0, hba1c || 0, creatinine || 0, egfr || 0, sbp || 0, dbp || 0, weight || 0, gender === 'Male' ? 1 : 0];
  }, [selectedPatient]);

  const handleRunPrediction = useCallback(async () => {
    if (!patientFeatureVector) {
      toast({ title: "Cannot Run Prediction", description: "Select a patient with complete vital signs.", variant: "destructive" });
      return;
    }

    setIsPredicting(true);
    try {
      const newPrediction = await runSinglePrediction(patientFeatureVector);
      setModelPredictions(prev => prev.map(model => {
        if (model.model === "Random Forest Classifier") { 
          const updatedPredictions: PredictionItem[] = [{ ...newPrediction, outcome: `${newPrediction.outcome} for ${selectedPatient?.name}` }, ...model.predictions.slice(1)];
          return { ...model, predictions: updatedPredictions };
        }
        return model;
      }));
      toast({ title: "Prediction Successful", description: `New risk score for ${selectedPatient?.name} is ${(newPrediction.probability * 100).toFixed(1)}%` });
    } catch (error) {
      console.error("Failed to run prediction:", error);
      toast({ title: "Prediction Failed", description: "Could not get a new prediction from the model.", variant: "destructive" });
    } finally {
      setIsPredicting(false);
    }
  }, [patientFeatureVector, selectedPatient?.name, toast]);

  const getProbabilityColor = (prob: number) => { if (prob >= 0.6) return "text-risk-high"; if (prob >= 0.3) return "text-risk-medium"; return "text-risk-low"; };
  const getProbabilityBg = (prob: number) => { if (prob >= 0.6) return "bg-risk-high-bg"; if (prob >= 0.3) return "bg-risk-medium-bg"; return "bg-risk-low-bg"; };
  
  if (loading) {
    return <DashboardLayout><div className="flex h-full w-full items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-4 text-xl text-muted-foreground">Loading Model Predictions...</p></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">ML Predictions</h1>
            <p className="text-sm md:text-base text-muted-foreground">Machine learning model outputs and interpretability</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button variant="outline" className="flex items-center justify-center space-x-2 w-full sm:w-auto text-sm"><Download className="w-4 h-4" /><span>Export Results</span></Button>
            <Button onClick={handleRunPrediction} disabled={isPredicting || isFetchingPatient || !selectedPatientId} className="flex items-center justify-center space-x-2 bg-gradient-medical w-full sm:w-auto text-sm">
              {isPredicting || isFetchingPatient ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}<span>{isPredicting ? "Running..." : "Run Prediction"}</span>
            </Button>
          </div>
        </div>
        
        <Card className="p-4 md:p-6 shadow-card">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="patient-selector">Run New Prediction for Patient</Label>
                    <Select onValueChange={setSelectedPatientId} value={selectedPatientId}><SelectTrigger id="patient-selector"><SelectValue placeholder="Select a patient..." /></SelectTrigger>
                        <SelectContent>{patients.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                    </Select>
                </div>
            </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {modelPredictions.map((model, index) => (
          <Card key={index} className="p-4 md:p-6 shadow-card">
            <div className="flex items-center justify-between mb-4 md:mb-6"><h3 className="text-base md:text-lg font-semibold">{model.model}</h3><Brain className="w-8 h-8 text-primary" /></div>
            <div className="grid grid-cols-2 gap-4 mb-6"><div className="text-center p-3 bg-muted rounded-lg"><p className="text-sm text-muted-foreground">Accuracy</p><p className="text-xl font-bold text-foreground">{model.accuracy}%</p></div><div className="text-center p-3 bg-muted rounded-lg"><p className="text-sm text-muted-foreground">F1 Score</p><p className="text-xl font-bold text-foreground">{model.f1Score}%</p></div></div>
            <div className="space-y-3"><h4 className="font-medium text-sm text-muted-foreground">Live Predictions</h4>{model.predictions.map((pred, predIndex) => <div key={predIndex} className={`p-4 rounded-lg ${getProbabilityBg(pred.probability)}`}><div className="flex items-center justify-between mb-2"><span className="font-medium text-sm">{pred.outcome}</span><Badge variant="outline" className={pred.confidence === 'High' ? "bg-risk-high-bg text-risk-high border-risk-high" : pred.confidence === 'Medium' ? "bg-risk-medium-bg text-risk-medium border-risk-medium" : "bg-risk-low-bg text-risk-low border-risk-low"}>{pred.confidence}</Badge></div><div className="flex items-center justify-between"><Progress value={pred.probability * 100} className="flex-1 mr-3" /><span className={`font-bold ${getProbabilityColor(pred.probability)}`}>{(pred.probability * 100).toFixed(1)}%</span></div></div>)}</div>
          </Card>))}
        </div>

        <Card className="p-6 shadow-card">
          <div className="flex items-center justify-between mb-6"><h3 className="text-xl font-semibold flex items-center"><Eye className="w-5 h-5 mr-2 text-primary" />Feature Importance Analysis (SHAP)</h3><Button variant="outline" className="flex items-center space-x-2"><BarChart3 className="w-4 h-4" /><span>Detailed SHAP Plot</span></Button></div>
          <div className="space-y-4">{featureImportance.map((feature, index) => <div key={index} className="p-4 border border-border rounded-lg"><div className="flex items-center justify-between mb-3"><div className="flex-1"><h4 className="font-medium">{feature.feature}</h4><p className="text-sm text-muted-foreground">{feature.description}</p></div><div className="text-right"><span className="font-bold text-lg text-primary">{(feature.importance * 100).toFixed(1)}%</span><p className="text-xs text-muted-foreground">Importance</p></div></div><Progress value={feature.importance * 100} className="h-2" /></div>)}</div>
        </Card>

        <Card className="p-6 shadow-card">
          <h3 className="text-xl font-semibold mb-4 flex items-center"><Lightbulb className="w-5 h-5 mr-2 text-primary" />Key Insights</h3>
          <div className="space-y-4">
            <div className="p-4 bg-clinical-teal-light rounded-lg"><h4 className="font-medium text-clinical-teal mb-2">High Cardiovascular Risk</h4><p className="text-sm text-muted-foreground">Models highlight age, uncontrolled BP, and HbA1c as primary risk drivers.</p></div>
            <div className="p-4 bg-risk-medium-bg rounded-lg"><h4 className="font-medium text-risk-medium mb-2">Polypharmacy Concern</h4><p className="text-sm text-muted-foreground">High medication count increases complexity. Consider medication reconciliation.</p></div>
          </div>
        </Card>

      </div>
    </DashboardLayout>
  );
}
