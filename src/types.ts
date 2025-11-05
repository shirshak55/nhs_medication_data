export interface LinkItem {
    text: string
    url: string
}

export interface QAItem {
    question: string
    answer: string
}

export interface MedicinePage {
    sectionName: string
    description?: string
    keyFacts?: string[]
    qa?: QAItem[]
}

export interface MedicineInfo {
    name: string
    otherBrandNames: Array<string>
    url: string
    description?: string
    pages: MedicinePage[]
    relatedConditions: LinkItem[]
    usefulResources: LinkItem[]
}
