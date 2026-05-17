import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import BrandStorySection from '../components/BrandStorySection';
import PainPointSection from '../components/PainPointSection';
import SolutionSection from '../components/SolutionSection';
import ATRSection from '../components/ATRSection';
import ThreeModesSection from '../components/ThreeModesSection';
import ProcessSection from '../components/ProcessSection';
import ComparisonSection from '../components/ComparisonSection';
import BenefitsSection from '../components/BenefitsSection';
import TrustSection from '../components/TrustSection';
import MarketSection from '../components/MarketSection';
import ContactSection from '../components/ContactSection';
import SectionMediaStrip from '../components/SectionMediaStrip';
import Footer from '../components/Footer';
import LoadingScreen from '../components/LoadingScreen';

export default function LandingPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <LoadingScreen onComplete={() => setLoading(false)} />;

  return (
    <Box sx={{ overflowX: 'hidden' }}>
      <Navbar />
      <HeroSection />
      <SectionMediaStrip position="after_hero" />
      <BrandStorySection />
      <SectionMediaStrip position="after_brand_story" />
      <PainPointSection />
      <SectionMediaStrip position="after_pain_point" />
      <SolutionSection />
      <SectionMediaStrip position="after_solution" />
      <ATRSection />
      <SectionMediaStrip position="after_atr" />
      <ThreeModesSection />
      <SectionMediaStrip position="after_three_modes" />
      <ProcessSection />
      <SectionMediaStrip position="after_process" />
      <ComparisonSection />
      <SectionMediaStrip position="after_comparison" />
      <BenefitsSection />
      <SectionMediaStrip position="after_benefits" />
      <TrustSection />
      <SectionMediaStrip position="after_trust" />
      <MarketSection />
      <SectionMediaStrip position="after_market" />
      <ContactSection />
      <Footer />
    </Box>
  );
}
