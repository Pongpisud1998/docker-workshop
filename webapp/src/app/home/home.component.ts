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

    // GeoServer & PHP API Integration
    geoServerLayer: L.TileLayer.WMS | undefined;
    isGeoServerLayerActive = false;
    phpTileLayer: L.TileLayer | undefined;
    isPhpTileLayerActive = false;

    testPhpApi(): void {
        this.http.get('/php-api/').subscribe({
            next: (data: any) => {
                alert(`PHP API Response:\nStatus: ${data.status}\nMessage: ${data.message}\nDatabase: ${data.database}`);
            },
            error: (err) => {
                console.error('PHP API Error', err);
                alert('Failed to connect to PHP API');
            }
        });
    }

    togglePhpTileLayer(): void {
        if (!this.map) return;

        if (this.isPhpTileLayerActive) {
            // Remove
            if (this.phpTileLayer) {
                this.map.removeLayer(this.phpTileLayer);
            }
            this.isPhpTileLayerActive = false;
        } else {
            // Add XYZ Layer from PHP
            // /php-api/index.php?z={z}&x={x}&y={y}
            this.phpTileLayer = L.tileLayer('/php-api/index.php?z={z}&x={x}&y={y}', {
                maxZoom: 25,
                attribution: '© PHP MBTiles'
            });

            this.phpTileLayer.addTo(this.map);
            this.isPhpTileLayerActive = true;

            // Fetch Bounds and Zoom
            this.http.get<any>('/php-api/index.php?metadata=true').subscribe({
                next: (data) => {
                    if (data) {
                        // 1. Set Min/Max Zoom if available
                        if (this.phpTileLayer && data.minzoom !== undefined && data.maxzoom !== undefined) {
                            // Direct options assignment as setMinZoom/setMaxZoom methods don't exist on TileLayer type
                            (this.phpTileLayer as any).options.minZoom = data.minzoom;
                            (this.phpTileLayer as any).options.maxZoom = data.maxzoom;
                            console.log(`Updated Layer Zoom: Min=${data.minzoom}, Max=${data.maxzoom}`);
                        }

                        // 2. Fit Bounds
                        if (data.bounds) {
                            // Bounds format: "minLon,minLat,maxLon,maxLat"
                            const parts = data.bounds.split(',').map((p: string) => parseFloat(p));
                            if (parts.length === 4 && this.map) {
                                // Leaflet bounds: [[minLat, minLon], [maxLat, maxLon]]
                                const bounds: L.LatLngBoundsExpression = [
                                    [parts[1], parts[0]], // SouthWest
                                    [parts[3], parts[2]]  // NorthEast
                                ];
                                this.map.fitBounds(bounds);
                                console.log('Fitted bounds to MBTiles:', bounds);
                            }
                        }
                    }
                },
                error: (err) => {
                    console.error('Failed to load MBTiles metadata:', err);
                }
            });
        }
    }

    toggleGeoServerLayer(): void {
        if (!this.map) return;

        if (this.isGeoServerLayerActive) {
            // Remove
            if (this.geoServerLayer) {
                this.map.removeLayer(this.geoServerLayer);
            }
            this.isGeoServerLayerActive = false;
        } else {
            // Add
            // Using a default layer from GeoServer (e.g., ne:world) for demonstration
            // Pointing to the Proxy: /geoserver/raster/wms
            this.geoServerLayer = L.tileLayer.wms('/geoserver/raster/wms', {
                layers: 'raster:S2B_MSIL1C_20181106_RGB',
                format: 'image/png',
                transparent: true,
                attribution: '© GeoServer'
            });

            this.geoServerLayer.addTo(this.map);
            this.isGeoServerLayerActive = true;
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
