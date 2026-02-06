import { Component, inject } from '@angular/core';
import {
  IonContent,
  IonButton,
  IonInput,
  IonItem,
  IonList,
  IonLabel,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { SplitBillService } from '../core/splitbill.service';
import { Group, Invite, Participant, UUID } from '../core/models';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonButton,
    IonInput,
    IonItem,
    IonList,
    IonLabel,
    IonSelect,
    IonSelectOption,
    FormsModule,
  ],
})
export class Tab1Page {
  name = '';
  participants: Participant[] = [];
  me: Participant | undefined;
  // Groups & invites
  myGroups: Group[] = [];
  selectedGroupId: UUID | '' = '';
  newGroupName = '';
  inviteEmail = '';
  pendingInvites: Invite[] = [];
  userInviteEmail = '';
  userInviteStatus: 'idle' | 'searching' | 'added' | 'notfound' | 'error' =
    'idle';
  private sb = inject(SplitBillService);

  constructor() {
    void this.refresh();
  }

  async refresh() {
    await this.sb.syncInvites();
    this.participants = this.sb.listParticipants();
    this.me = this.sb.getCurrentParticipant();
    this.myGroups = this.sb.listGroupsForCurrentUser();
    this.pendingInvites = this.sb.listPendingInvitesForCurrentUser();
  }
  async addUserByEmail() {
    const email = this.userInviteEmail.trim();
    if (!email) return;
    this.userInviteStatus = 'searching';
    const p = await this.sb.addParticipantByEmail(email);
    if (p) {
      this.userInviteStatus = 'added';
      this.userInviteEmail = '';
      await this.refresh();
      setTimeout(() => (this.userInviteStatus = 'idle'), 2000);
    } else {
      this.userInviteStatus = 'notfound';
      setTimeout(() => (this.userInviteStatus = 'idle'), 3000);
    }
  }
  remove(id: string) {
    if (this.me && id === this.me.id) return; // don't remove current user
    this.sb.removeParticipant(id);
    void this.refresh();
  }

  ionViewWillEnter() {
    void this.refresh();
  }
  // Groups
  createGroup() {
    const name = this.newGroupName.trim();
    if (!name) return;
    const me = this.sb.getCurrentParticipant();
    if (!me) return;
    this.sb.addGroup(name, [me.id]);
    this.newGroupName = '';
    this.refresh();
  }
  onSelectGroup(id: string) {
    this.selectedGroupId = id as UUID;
  }
  groupMembers(): Participant[] {
    if (!this.selectedGroupId) return [];
    const g = this.myGroups.find((gg) => gg.id === this.selectedGroupId);
    if (!g) return [];
    const ids = new Set(g.memberIds);
    return this.participants.filter((p) => ids.has(p.id));
  }
  async invite() {
    const email = this.inviteEmail.trim();
    if (!email || !this.selectedGroupId) return;
    await this.sb.inviteToGroup(this.selectedGroupId as UUID, email);
    this.inviteEmail = '';
    await this.refresh();
  }

  removeMember(memberId: UUID) {
    if (!this.selectedGroupId) return;
    this.sb.removeParticipantFromGroup(this.selectedGroupId as UUID, memberId);
    void this.refresh();
  }
  leaveGroup() {
    const me = this.sb.getCurrentParticipant();
    if (!me || !this.selectedGroupId) return;
    this.sb.removeParticipantFromGroup(this.selectedGroupId as UUID, me.id);
    this.selectedGroupId = '';
    void this.refresh();
  }

  isMe(p: Participant) {
    return this.me && p.id === this.me.id;
  }
}
