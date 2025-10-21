
import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    const { url, token } = await request.json();

    const response = await axios.get(`${url}/api/applications/`, {
      headers: {
        Authorization: `Token ${token}`,
      },
      timeout: 5000,
    });

    return NextResponse.json({ success: true, data: response.data });
  } catch (error: any) {
    console.error('Baserow test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error?.message ?? 'Connection failed'
    });
  }
}
