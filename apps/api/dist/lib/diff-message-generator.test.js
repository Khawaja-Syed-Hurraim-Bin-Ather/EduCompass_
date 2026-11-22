"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const diff_message_generator_1 = require("./diff-message-generator");
(0, vitest_1.describe)('Deterministic Diff-to-Sentence Approval Message Generator (Section 4.3)', () => {
    (0, vitest_1.it)('generates standard operator to chairman approval message', () => {
        const diffs = [
            {
                recordName: 'Data Science Career Track',
                field: 'description',
                oldValue: 'Overview of modern data engineering',
                newValue: 'Updated industry roadmap for 2026',
                op: 'update',
            },
        ];
        const msg = (0, diff_message_generator_1.generateApprovalMessage)({
            publicRef: 'CIS-2026-0042',
            approverName: 'Dr. Muhammad Ali',
            approverRole: 'Chairman',
            approverEmail: 'chairman.cis@nedut.edu.pk',
            requesterName: 'Syed Hurraim',
            requesterRole: 'Data-entry operator',
            departmentName: 'Computer & Information Systems Engineering',
            moduleName: 'Career Hub',
            sectionName: 'Tracks',
            diffItems: diffs,
            reason: 'Align track with newly introduced semester 6 electives',
            impact: 'Minor',
            targetAudience: 'visible to all students',
            expiresAt: '2026-11-03 17:00 PKT',
            code: '849201',
        });
        (0, vitest_1.expect)(msg).toContain('APPROVAL REQUEST CIS-2026-0042');
        (0, vitest_1.expect)(msg).toContain('To: Dr. Muhammad Ali, Chairman, chairman.cis@nedut.edu.pk');
        (0, vitest_1.expect)(msg).toContain('From: Syed Hurraim, Data-entry operator, Department of Computer & Information Systems Engineering');
        (0, vitest_1.expect)(msg).toContain('Module: Career Hub > Tracks');
        (0, vitest_1.expect)(msg).toContain('Action: Edit 1 record');
        (0, vitest_1.expect)(msg).toContain('1. Data Science Career Track (description): "Overview of modern data engineering" -> "Updated industry roadmap for 2026"');
        (0, vitest_1.expect)(msg).toContain('Reason given: Align track with newly introduced semester 6 electives');
        (0, vitest_1.expect)(msg).toContain('Impact: Minor, visible to all students');
        (0, vitest_1.expect)(msg).toContain('To approve: log in to the EduCompass admin panel, open Approvals, and enter code 849201');
        (0, vitest_1.expect)(msg).toContain('This message does not give anyone permission by itself.');
    });
    (0, vitest_1.it)('generates VC escalation header when routed to Vice Chancellor', () => {
        const diffs = [
            {
                recordName: 'CS-218 Prerequisites',
                field: 'rule',
                oldValue: 'Requires CS-115',
                newValue: 'Requires CS-116',
                op: 'update',
            },
        ];
        const msg = (0, diff_message_generator_1.generateApprovalMessage)({
            publicRef: 'CIS-2026-0099',
            approverName: 'Dr. Sarosh Lodhi',
            approverRole: 'Vice Chancellor',
            approverEmail: 'vc@nedut.edu.pk',
            requesterName: 'Dr. Muhammad Ali',
            requesterRole: 'Department Chairman',
            departmentName: 'Computer & Information Systems Engineering',
            moduleName: 'Curriculum',
            sectionName: 'Prerequisites',
            diffItems: diffs,
            reason: 'Major scheme revision for Scheme 2026',
            impact: 'Major',
            targetAudience: 'visible to all students',
            expiresAt: '2026-11-03 17:00 PKT',
            code: '551940',
        });
        (0, vitest_1.expect)(msg).toContain('Contact the Vice Chancellor at <vc@nedut.edu.pk>.');
        (0, vitest_1.expect)(msg).toContain('APPROVAL REQUEST CIS-2026-0099');
        (0, vitest_1.expect)(msg).toContain('Impact: Major, visible to all students');
    });
    (0, vitest_1.it)('caps diff list at 20 lines with summary notice', () => {
        const diffs = [];
        for (let i = 1; i <= 25; i++) {
            diffs.push({
                recordName: `Course CS-${100 + i}`,
                field: 'credits',
                oldValue: 3,
                newValue: 4,
                op: 'update',
            });
        }
        const msg = (0, diff_message_generator_1.generateApprovalMessage)({
            publicRef: 'CIS-2026-0100',
            approverName: 'Dr. Muhammad Ali',
            approverRole: 'Chairman',
            approverEmail: 'chairman.cis@nedut.edu.pk',
            requesterName: 'Operator',
            requesterRole: 'Operator',
            departmentName: 'CISE',
            moduleName: 'Curriculum',
            diffItems: diffs,
            reason: 'Batch credit adjustment',
            impact: 'Major',
            expiresAt: '2026-11-03',
            code: '123456',
        });
        (0, vitest_1.expect)(msg).toContain('20. Course CS-120 (credits): "3" -> "4"');
        (0, vitest_1.expect)(msg).toContain('... and 5 more, see the panel');
        (0, vitest_1.expect)(msg).not.toContain('21. Course CS-121');
    });
});
