import undici from 'undici';
import ms from 'ms';
import pQueue from 'p-queue';
import sleep from 'timers/promises';
import parseConfig from '../Config';
import * as log from '../Log';

import type { HttpMethod } from 'undici/types/dispatcher';
import type { EligibilityPayload } from '../Interfaces/Eligibility';
import type { AvailableLocationPayload, AvailableLocationResponse } from '../Interfaces/AvailableLocation';
import type { AvailableLocationDatesPayload, AvailableLocationDatesResponse } from '../Interfaces/AvailableLocationDates';

class TexasScheduler {
    public requestInstance = new undici.Pool('https://publicapi.txdpsscheduler.com');
    public config = parseConfig();
    private availableLocation: AvailableLocationResponse[] | null = null;
    private queue = new pQueue();

    public constructor() {
        if (this.config.appSettings.webserver) require('http').createServer((req: any, res: any) => res.end('Bot is alive!')).listen(process.env.PORT || 3000);
        log.info('Texas Scheduler is starting...');
        log.info('Requesting Avaliable Location....');
        this.run();
    }

    public async run() {
        await this.requestAvaliableLocation();
        await this.getLocationDatesAll();
    }

    public async getResponseId() {
        const requestBody: EligibilityPayload = {
            FirstName: this.config.personalInfo.firstName,
            LastName: this.config.personalInfo.lastName,
            DateOfBirth: this.config.personalInfo.dob,
            LastFourDigitsSsn: this.config.personalInfo.lastFourSSN,
            CardNumber: '',
        };
        const response = await this.requestApi('/api/Eligibility', 'POST', requestBody).then(res => res.body.json());
        return response[0].ResponseId;
    }

    public async requestAvaliableLocation(): Promise<void> {
        const requestBody: AvailableLocationPayload = {
            CityName: '',
            PreferredDay: this.config.location.preferredDays,
            TypeId: this.config.personalInfo.typeId || 71,
            ZipCode: this.config.location.zipCode,
        };
        const response: AvailableLocationResponse[] = await this.requestApi('/api/AvailableLocation/', 'POST', requestBody)
            .then(res => res.body.json())
            .then(res => res.filter((location: AvailableLocationResponse) => location.Distance < this.config.location.miles));
        log.info(`Found ${response.length} avaliable location that match your criteria`);
        log.info(`${response.map(el => el.Name).join(', ')}`);
        this.availableLocation = response;
        return;
    }

    private async getLocationDatesAll() {
        log.info('Checking Avaliable Location Dates....');
        if (!this.availableLocation) return;
        const getLocationFunctions = this.availableLocation.map(location => () => this.getLocationDates(location));
        for (;;) {
            console.log('--------------------------------------------------------------------------------');
            await this.queue.addAll(getLocationFunctions).catch(() => null);
            await sleep.setTimeout(this.config.appSettings.interval);
        }
    }

    private async getLocationDates(location: AvailableLocationResponse) {
        const requestBody: AvailableLocationDatesPayload = {
            LocationId: location.Id,
            PreferredDay: this.config.location.preferredDays,
            SameDay: this.config.location.sameDay,
            StartDate: null,
            TypeId: this.config.personalInfo.typeId || 71,
        };
        const response: AvailableLocationDatesResponse = await this.requestApi('/api/AvailableLocationDates', 'POST', requestBody).then(res => res.body.json());
        const avaliableDates = response.LocationAvailabilityDates.filter(
            date => new Date(date.AvailabilityDate).valueOf() - new Date().valueOf() < ms(`${this.config.location.daysAround}d`) && date.AvailableTimeSlots.length > 0,
        );
        if (avaliableDates.length !== 0) {
            const booking = avaliableDates[0].AvailableTimeSlots[0];
            log.info(`${location.Name} is avaliable on ${booking.FormattedStartDateTime}`);
            if (!this.queue.isPaused) this.queue.pause();
            return Promise.resolve(true);
        }
        log.info(`${location.Name} is not avaliable in around ${this.config.location.daysAround} days`);
        return Promise.reject();
    }

    private async requestApi(path: string, method: HttpMethod, body: object) {
        const response = await this.requestInstance.request({
            method,
            path,
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                Origin: 'https://public.txdpsscheduler.com',
                Referer: 'https://public.txdpsscheduler.com/',
            },
            headersTimeout: this.config.appSettings.headersTimeout,
            body: JSON.stringify(body),
        });
        return await response;
    }

}

export default TexasScheduler;

