import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-qr-code',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="qr-code-container">
      <img *ngIf="qrImageUrl" [src]="qrImageUrl" alt="Código QR" class="qr-image">
      <div *ngIf="!qrImageUrl" class="qr-loading">
        <div class="loading-spinner"></div>
        <span>Generando código QR...</span>
      </div>
    </div>
  `,
  styles: [`
    .qr-code-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 300px;
      background-color: #f9f9f9;
      border-radius: 8px;
      padding: 20px;
    }
    .qr-image {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
    }
    .qr-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      border-top: 4px solid #128C7E;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `]
})
export class QrCodeComponent implements OnChanges {
  @Input() qrData: string | null = null;
  qrImageUrl: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['qrData'] && this.qrData) {
      // Si el QR ya es una URL de datos o una URL de imagen, usarla directamente
      if (this.qrData.startsWith('data:') || this.qrData.startsWith('http')) {
        this.qrImageUrl = this.qrData;
      } else {
        // Usar la API de Google Charts para generar el QR
        this.qrImageUrl = 'https://chart.googleapis.com/chart?cht=qr&chl=' + 
                          encodeURIComponent(this.qrData) + 
                          '&chs=300x300&chld=H|0';
      }
    } else {
      this.qrImageUrl = null;
    }
  }
}