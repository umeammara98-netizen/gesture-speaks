"""SignTransformer, copied from the training notebook so the checkpoint keys match."""

import torch
import torch.nn as nn


class SignTransformer(nn.Module):
    def __init__(self, in_dim, n_cls, d=128, heads=4, layers=3, ff=256, drop=0.2, T=48):
        super().__init__()
        self.inp = nn.Sequential(nn.LayerNorm(in_dim), nn.Linear(in_dim, d), nn.Dropout(drop))
        self.cls = nn.Parameter(torch.zeros(1, 1, d))
        self.pos = nn.Parameter(torch.randn(1, T + 1, d) * 0.02)
        layer = nn.TransformerEncoderLayer(
            d, heads, ff, drop, batch_first=True, norm_first=True, activation="gelu"
        )
        self.enc = nn.TransformerEncoder(layer, layers, enable_nested_tensor=False)
        self.head = nn.Sequential(nn.LayerNorm(d), nn.Linear(d, n_cls))

    def forward(self, x):
        h = self.inp(x)
        h = torch.cat([self.cls.expand(len(h), -1, -1), h], dim=1) + self.pos
        h = self.enc(h)
        return self.head(h[:, 0])
