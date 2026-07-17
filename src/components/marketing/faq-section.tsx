"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { faqItems } from "@/lib/launch-content"

export function FaqSection({ id }: { id: string }) {
  return (
    <section id={id} data-registry-block="faq3" className="border-b">
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="text-center">
          <p className="text-sm font-semibold text-primary">FAQ</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Häufige Fragen vor dem ersten Audit.</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">Klare Produktgrenzen statt Kleingedrucktem.</p>
        </div>
        <Accordion type="single" collapsible className="mt-10 border-t">
          {faqItems.map((item, index) => (
            <AccordionItem key={item.question} value={`faq-${index}`}>
              <AccordionTrigger className="py-5 text-base">{item.question}</AccordionTrigger>
              <AccordionContent className="max-w-2xl pb-5 text-sm leading-6 text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
