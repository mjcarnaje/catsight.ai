
import { Button } from "@/components/ui/button"
import { Search, BookOpen, Users } from "lucide-react"

const HeroSection = () => {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-background"></div>
      <div className="relative px-6 py-24 mx-auto max-w-7xl lg:px-8 sm:py-32">
        <div className="flex flex-col items-center gap-16 lg:flex-row">
          <div className="flex-1 text-left">
            <h1 className="text-4xl font-bold tracking-tight text-transparent sm:text-6xl bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text">
              AI-Powered Document Analysis
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Unleash the power of AI for intelligent document search and analysis at MSU-IIT. Upload, search, and chat with your documents using advanced language models.
            </p>
            <div className="flex mt-10 gap-x-6">
              <Button size="lg" className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
                Get Started
              </Button>
              <Button size="lg" variant="outline" className="border-primary/20 hover:bg-primary/5">
                Learn More
              </Button>
            </div>
          </div>
          <div className="relative flex-1">
            <img
              src="/icon.png"
              alt="CATSight.AI Logo"
              className="w-full max-w-[400px] mx-auto hover:scale-105 transition-transform duration-300"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default HeroSection;
