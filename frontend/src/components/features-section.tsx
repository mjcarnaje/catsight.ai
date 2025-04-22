
import { Search, BookOpen, Users } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

const features = [
  {
    name: "Semantic Search",
    description: "Advanced content-based search across your document collection using state-of-the-art embedding models.",
    icon: Search,
  },
  {
    name: "Conversational AI",
    description: "Chat with your documents using our powerful Llama 3.2-powered chatbot with contextual understanding.",
    icon: BookOpen,
  },
  {
    name: "Role-Based Access",
    description: "Secure access control with predefined roles - SuperAdmin, Admin, and User levels.",
    icon: Users,
  },
]

const FeaturesSection = () => {
  return (
    <div className="relative py-24 overflow-hidden sm:py-32">
      <div className="absolute inset-0 bg-gradient-to-bl from-accent/10 via-primary/5 to-background"></div>
      <div className="relative px-6 mx-auto max-w-7xl lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold tracking-tight text-transparent sm:text-4xl bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text">
            Powerful Features
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Discover the capabilities that make CATSight.AI the perfect solution for MSU-IIT's document management needs.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 mx-auto mt-16 max-w-7xl sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.name} className="relative transition-transform duration-300 group hover:scale-105 border-primary/10 bg-gradient-to-br from-background to-primary/5">
              <div className="absolute inset-0 transition-opacity duration-300 rounded-lg opacity-0 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent group-hover:opacity-100"></div>
              <CardContent className="relative p-6">
                <div className="flex flex-col items-start gap-4">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">{feature.name}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

export default FeaturesSection; 
