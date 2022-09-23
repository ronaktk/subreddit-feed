export interface AvailableLocationPayload {
    CityName: string;
    PreferredDay: number;
    TypeId: number;
    ZipCode: string;
}

export interface AvailableLocationResponse {
    Id: number;
    Address: string;
    Distance: number;
    Name: string;
    NextAvailableDate: string;
}

