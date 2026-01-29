import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import parseGeoraster from 'georaster';
import GeoRasterLayer from 'georaster-layer-for-leaflet';
import { ProfileModalComponent } from '../profile-modal/profile-modal.component';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, ProfileModalComponent],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, AfterViewInit {
    username: string = '';
    userImage: string | null = null;
    currentUser: any = null;
    map: L.Map | undefined;
    layers: any[] = [];
    selectedFile: File | null = null;
    uploading: boolean = false;
    showProfileModal: boolean = false;

    // Layer Management
    activeLayers: Map<number, any> = new Map(); // Store Leaflet layer instances ON MAP
    cachedLayers: Map<number, any> = new Map(); // Store LOADED Leaflet layer instances (Memory)
    loadingLayers: Set<number> = new Set(); // Store IDs of layers currently loading

    constructor(
        private authService: AuthService,
        private router: Router,
        private http: HttpClient
    ) { }

    ngOnInit(): void {
        const user = this.authService.getCurrentUser();
        if (!user) {
            this.router.navigate(['/login']);
            return;
        }
        this.currentUser = user;
        this.username = user.username;
        this.userImage = user.image;
        this.loadLayers();
    }

    ngAfterViewInit(): void {
        this.initMap();
    }

    logout(): void {
        this.authService.logout();
        this.router.navigate(['/login']);
    }

    initMap(): void {
        this.map = L.map('map').setView([13.7563, 100.5018], 10); // Bangkok

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
    }

    onFileSelected(event: any): void {
        const file: File = event.target.files[0];
        if (file) {
            this.selectedFile = file;
        }
    }

    uploadRaster(): void {
        if (!this.selectedFile) return;

        this.uploading = true;
        const formData = new FormData();
        formData.append('file', this.selectedFile);

        // Assuming API is proxied via Nginx at /api
        this.http.post<any>('/api/upload-raster', formData).subscribe({
            next: (res) => {
                alert('Upload successful!');
                this.uploading = false;
                this.selectedFile = null;
                // Reset file input
                const fileInput = document.getElementById('rasterInput') as HTMLInputElement;
                if (fileInput) fileInput.value = '';

                this.loadLayers();
                // Automatically add to map
                // this.addLayerToMap({ name: res.name, path: res.url }); // Need name from somewhere
            },
            error: (err) => {
                console.error('Upload failed', err);
                alert('Upload failed');
                this.uploading = false;
            }
        });
    }

    loadLayers(): void {
        this.http.get<any[]>('/api/layers').subscribe({
            next: (data) => {
                this.layers = data;
            },
            error: (err) => console.error('Error loading layers', err)
        });
    }

    toggleLayer(layer: any): void {
        if (!this.map) return;
        if (this.loadingLayers.has(layer.id)) return;

        // 1. If active (on map), remove it (HIDE)
        if (this.activeLayers.has(layer.id)) {
            const layerInstance = this.activeLayers.get(layer.id);
            this.map.removeLayer(layerInstance);
            this.activeLayers.delete(layer.id);
            return;
        }

        // 2. If already cached, just add it (SHOW)
        if (this.cachedLayers.has(layer.id)) {
            const layerInstance = this.cachedLayers.get(layer.id);
            layerInstance.addTo(this.map);
            this.activeLayers.set(layer.id, layerInstance);
            return;
        }

        // 3. Not in cache -> Load it
        this.loadAndAddLayer(layer);
    }

    async loadAndAddLayer(layer: any): Promise<void> {
        if (!this.map) return;
        this.loadingLayers.add(layer.id);

        try {
            const response = await fetch(layer.path);
            const arrayBuffer = await response.arrayBuffer();
            const georaster = await parseGeoraster(arrayBuffer);

            const layerNode = new GeoRasterLayer({
                georaster: georaster,
                opacity: 0.7,
                resolution: 128
            });

            layerNode.addTo(this.map);
            // this.map.fitBounds(layerNode.getBounds()); // Optional: maybe don't zoom on toggle? User request said "zoom to raster"
            this.map.fitBounds(layerNode.getBounds());

            this.activeLayers.set(layer.id, layerNode);
            this.cachedLayers.set(layer.id, layerNode); // Add to cache

        } catch (error) {
            console.error('Error loading layer:', error);
            alert('Failed to load layer.');
        } finally {
            this.loadingLayers.delete(layer.id);
        }
    }

    deleteLayer(layer: any): void {
        if (!confirm(`Are you sure you want to delete "${layer.name}"?`)) return;

        this.http.delete(`/api/layers/${layer.id}`).subscribe({
            next: () => {
                // 1. Remove from map if active
                if (this.activeLayers.has(layer.id)) {
                    this.map?.removeLayer(this.activeLayers.get(layer.id));
                    this.activeLayers.delete(layer.id);
                }
                // 2. Remove from cache
                this.cachedLayers.delete(layer.id);

                // 3. Remove from UI list
                this.layers = this.layers.filter(l => l.id !== layer.id);
            },
            error: (err) => {
                console.error('Delete failed', err);
                alert('Failed to delete layer');
            }
        });
    }

    isLayerActive(layerId: number): boolean {
        return this.activeLayers.has(layerId);
    }

    isLayerLoading(layerId: number): boolean {
        return this.loadingLayers.has(layerId);
    }
}
