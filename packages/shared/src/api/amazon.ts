import type { AmazonPO, AmazonItem, AmazonListing } from '../types/amazon.js'

export interface ListAmazonPOsResponse {
  items: AmazonPO[]
  total: number
}

export interface CreateAmazonPORequest {
  poNumber: string
  poDate: string
  status: AmazonPO['status']
  items: AmazonPO['items']
}

export interface UpdateAmazonPORequest {
  poNumber?: string
  poDate?: string
  status?: AmazonPO['status']
  items?: AmazonPO['items']
  movedToOutgoing?: boolean
}

export interface ListAmazonItemsResponse {
  items: AmazonItem[]
  total: number
}

export interface ListAmazonListingsResponse {
  items: AmazonListing[]
  total: number
}
