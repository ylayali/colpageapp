import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const CAPTURE_DIR = path.join(process.cwd(), 'webhook-captures')

// Ensure capture directory exists
async function ensureCaptureDir() {
  try {
    await fs.access(CAPTURE_DIR)
  } catch {
    await fs.mkdir(CAPTURE_DIR, { recursive: true })
    console.log(`Created webhook capture directory: ${CAPTURE_DIR}`)
  }
}

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString()
  const captureId = `capture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  try {
    // Capture all possible data
    const url = request.url
    const method = request.method
    const headers = Object.fromEntries(request.headers.entries())
    
    // Get body as text first, then try to parse as JSON
    const bodyText = await request.text()
    let bodyJson = null
    try {
      bodyJson = JSON.parse(bodyText)
    } catch {
      // Body is not JSON, keep as text
    }

    const captureData = {
      captureId,
      timestamp,
      url,
      method,
      headers,
      bodyText,
      bodyJson,
      searchParams: Object.fromEntries(new URL(url).searchParams.entries()),
    }

    // Log to console with clear formatting
    console.log('\n' + '='.repeat(80))
    console.log(`🔍 WEBHOOK CAPTURE: ${captureId}`)
    console.log(`⏰ Timestamp: ${timestamp}`)
    console.log('='.repeat(80))
    
    console.log('\n📍 REQUEST INFO:')
    console.log(`URL: ${url}`)
    console.log(`Method: ${method}`)
    
    console.log('\n📋 HEADERS:')
    Object.entries(headers).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`)
    })
    
    if (Object.keys(captureData.searchParams).length > 0) {
      console.log('\n🔍 QUERY PARAMETERS:')
      Object.entries(captureData.searchParams).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`)
      })
    }
    
    console.log('\n📦 BODY (Raw Text):')
    console.log(bodyText)
    
    if (bodyJson) {
      console.log('\n📊 BODY (Parsed JSON):')
      console.log(JSON.stringify(bodyJson, null, 2))
    }
    
    console.log('\n' + '='.repeat(80) + '\n')

    // Save to file for later analysis
    await ensureCaptureDir()
    const filename = `${captureId}.json`
    const filepath = path.join(CAPTURE_DIR, filename)
    await fs.writeFile(filepath, JSON.stringify(captureData, null, 2))
    console.log(`💾 Saved capture to: ${filepath}`)

    // Also save a summary file with just the key info
    const summaryData = {
      timestamp,
      event: bodyJson?.event || 'unknown',
      buyer_email: bodyJson?.buyer_email || bodyJson?.email || 'unknown',
      amount: bodyJson?.amount || 'unknown',
      product_id: bodyJson?.product_id || 'unknown',
      subscription_type: bodyJson?.subscription_type || 'unknown',
      bodyJson
    }
    
    const summaryPath = path.join(CAPTURE_DIR, 'summary.json')
    let existingSummaries = []
    try {
      const existingData = await fs.readFile(summaryPath, 'utf8')
      existingSummaries = JSON.parse(existingData)
    } catch {
      // File doesn't exist yet
    }
    
    existingSummaries.push(summaryData)
    await fs.writeFile(summaryPath, JSON.stringify(existingSummaries, null, 2))

    // Return success response to GrooveSell
    return NextResponse.json({ 
      success: true,
      message: 'Webhook captured successfully',
      captureId,
      timestamp 
    })

  } catch (error) {
    console.error('❌ Error capturing webhook:', error)
    
    // Still return success so GrooveSell doesn't retry
    return NextResponse.json({ 
      success: true,
      message: 'Webhook received (error in processing)',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Allow viewing captured data
    await ensureCaptureDir()
    const files = await fs.readdir(CAPTURE_DIR)
    const jsonFiles = files.filter(f => f.endsWith('.json'))
    
    const { searchParams } = new URL(request.url)
    const file = searchParams.get('file')
    
    if (file && jsonFiles.includes(file)) {
      const content = await fs.readFile(path.join(CAPTURE_DIR, file), 'utf8')
      return new NextResponse(content, {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Return list of available files
    return NextResponse.json({
      availableCaptures: jsonFiles,
      message: 'Add ?file=filename.json to view specific capture'
    })
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
