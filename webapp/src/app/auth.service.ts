import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    // In a real app, use environment variables.
    // For Docker setup: 
    // Browser (Host) -> WebApp (Container) -> Browser -> API (localhost:3000)
    // Since the browser runs the JS, it calls localhost:3000.
    private apiUrl = 'http://localhost:3000';

    constructor(private http: HttpClient) { }

    login(credentials: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/login`, credentials);
    }

    uploadProfile(userId: number, file: File): Observable<any> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post(`${this.apiUrl}/upload/${userId}`, formData);
    }
}
