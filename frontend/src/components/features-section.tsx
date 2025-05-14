import {
  FileText,
  Bot,
  Layers3,
  Sparkles,
  SearchCheck,
  Settings2,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

const features = [
  {
    name: "Smart Document Conversion",
    description:
      "Converts scanned PDFs and complex layouts into clean, readable text using AI-powered tools for accuracy and structure.",
    icon: FileText,
  },
  {
    name: "Automatic Summaries",
    description:
      "Summarizes documents into clear overviews, titles, topics, and dates so you can understand the key points in seconds.",
    icon: Layers3,
  },
  {
    name: "Interactive Chat Assistant",
    description:
      "Ask questions about your documents and get instant, accurate answers — just like chatting with a helpful expert.",
    icon: Bot,
  },
  {
    name: "Meaningful Search",
    description:
      "Find exactly what you need with smart search that understands the meaning behind your questions, not just keywords.",
    icon: SearchCheck,
  },
  {
    name: "Smarter Answers You Can Trust",
    description:
      "Behind the scenes, the assistant double-checks sources and picks the best information before answering your questions.",
    icon: Settings2,
  },
  {
    name: "Answers with References",
    description:
      "Every answer includes clear sources, so you always know where the information came from in your documents.",
    icon: Sparkles,
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
            Discover what makes CATSight.AI the smarter way to manage, explore, and understand your documents.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 mx-auto mt-16 max-w-7xl sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.name}
              className="relative transition-transform duration-300 group hover:scale-105 border-primary/10 bg-gradient-to-br from-background to-primary/5"
            >
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
