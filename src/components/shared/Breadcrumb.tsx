'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-[12px] font-semibold" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }} />}
          {item.href ? (
            <Link
              href={item.href}
              className="transition-colors hover:text-[rgba(255,255,255,0.80)]"
              style={{ color: 'rgba(255,255,255,0.47)' }}
            >
              {item.label}
            </Link>
          ) : (
            <span style={{ color: 'rgba(255,255,255,0.82)' }}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
